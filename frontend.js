/**
 * Bonobo plugin frontend bridge — hand-written browser ESM, no dependencies, no build step.
 *
 * Runs inside the host app's sandboxed plugin iframe for plugin pages and plugin file views alike,
 * and talks to the embedding host app over the current strict postMessage contract: the page
 * announces `bonobo:ready`, the host answers `bonobo:init` with a short-lived scoped bearer token,
 * and from then on the client calls the public `/api/v1/*` API on its own iframe origin directly
 * with `Authorization: Bearer <token>`. The `data` and `members` APIs stay on the bridge instead:
 * the page posts `bonobo:data-*` messages and the host performs those reads and writes as the
 * viewing member.
 */

/** `getToken` refreshes when the token is expired or expires within this margin. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const READY_RETRY_MS = 500;
const REFRESH_DEADLINE_MS = 10_000;
const DATA_REQUEST_DEADLINE_MS = 10_000;
const BRIDGE_NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates the `bonobo:init` context union: `kind: "page"` or `kind: "file_view"`.
 *
 * @param {unknown} value
 */
function is_ui_context(value) {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const context = /** @type {Record<string, unknown>} */ (value);
	if (
		typeof context.pluginName !== "string" ||
		typeof context.userId !== "string" ||
		typeof context.organizationId !== "string" ||
		typeof context.workspaceId !== "string"
	) {
		return false;
	}
	if (context.kind === "page") {
		return typeof context.pageId === "string" && typeof context.pageTitle === "string";
	}
	if (context.kind === "file_view") {
		if (typeof context.fileViewId !== "string" || typeof context.fileViewTitle !== "string") {
			return false;
		}
		if (typeof context.file !== "object" || context.file === null) {
			return false;
		}
		const file = /** @type {Record<string, unknown>} */ (context.file);
		return (
			typeof file.fileNodeId === "string" &&
			typeof file.name === "string" &&
			typeof file.path === "string" &&
			typeof file.contentType === "string"
		);
	}
	return false;
}

/**
 * Reads the host origin and frame nonce from the URL fragment. The fragment is available to the
 * page but is not sent in the asset request, cache key, or referrer.
 */
function read_bridge_bootstrap() {
	const fragment = window.location.hash.slice(1);
	if (!fragment) {
		throw new Error("Missing host bridge fragment — the page must be embedded by the Bonobo host app");
	}

	const params = new URLSearchParams(fragment);
	const parentOrigins = params.getAll("parentOrigin");
	const bridgeNonces = params.getAll("bridgeNonce");
	if (params.size !== 2 || parentOrigins.length !== 1 || bridgeNonces.length !== 1) {
		throw new Error("Invalid host bridge fragment");
	}

	const parentOrigin = parentOrigins[0];
	const bridgeNonce = bridgeNonces[0];
	let parsedParentOrigin;
	try {
		parsedParentOrigin = new URL(parentOrigin);
	} catch {
		throw new Error("Invalid host bridge parent origin");
	}
	if (
		(parsedParentOrigin.protocol !== "http:" && parsedParentOrigin.protocol !== "https:") ||
		parsedParentOrigin.origin !== parentOrigin
	) {
		throw new Error("Invalid host bridge parent origin");
	}
	if (!BRIDGE_NONCE_PATTERN.test(bridgeNonce)) {
		throw new Error("Invalid host bridge nonce");
	}

	return { parentOrigin, bridgeNonce };
}

/**
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init, token, and plugin-data responses), posts `{ type: "bonobo:ready", bridgeNonce }` to `window.parent`,
 * and resolves with the frontend client when the host's `bonobo:init` arrives. `bonobo:init`
 * messages after the first are ignored.
 *
 * The host puts its canonical HTTP(S) origin and a fresh frame nonce in the URL fragment. The SDK
 * validates both before connecting, sends ready only to that exact origin, and accepts host
 * messages only from that origin, `window.parent`, and the matching nonce. The token travels over
 * postMessage only and is never placed in a URL.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>}
 */
export async function bonobo_ui_connect() {
	const { parentOrigin, bridgeNonce } = read_bridge_bootstrap();

	// Token state — set by `bonobo:init`, updated by `bonobo:token`.
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;

	/** @type {Map<string, { resolve: (token: string) => void, reject: (error: Error) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_refreshes = new Map();
	/** @type {Promise<string> | null} */
	let refresh_in_flight = null;

	// Plugin-data bridge state — watch registrations route matching `bonobo:data-update` messages,
	// and the two pending maps correlate write and member-resolve requests with their `-result`
	// answers. A `_nay` result resolves (it is passed through as-is); only the deadline rejects.
	// The `kind` decides the update payload shape: a plain watch delivers the docs array, a
	// window delivers `{ docs, hasMore, atCapacity, incomplete }`. Death is a bare `null` for both.
	/** @type {Map<string, { kind: "plain" | "window", deliver: (update: any, info?: import("bonobo-plugin-sdk/frontend").BonoboUiWatchDeathInfo) => void }>} */
	const watch_registrations = new Map();
	/** @type {Map<string, { resolve: (result: import("bonobo-plugin-sdk/frontend").BonoboUiDataWriteResult) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_data_writes = new Map();
	/** @type {Map<string, { resolve: (members: Record<string, string | null>) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_member_resolves = new Map();

	// The document is going away (unload or bfcache). Drop every watch registration so a page
	// restored from bfcache cannot keep routing updates for subscriptions the host already cleared.
	window.addEventListener("pagehide", () => {
		watch_registrations.clear();
	});

	/**
	 * Returns the current token, refreshing it first when it is expired or within
	 * `TOKEN_EXPIRY_MARGIN_MS` of `tokenExpiresAt`.
	 *
	 * @returns {Promise<string>}
	 */
	async function getToken() {
		if (Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) {
			return refreshToken();
		}
		return token;
	}

	/**
	 * Asks the host for a fresh token. Concurrent callers share one in-flight
	 * `bonobo:token-refresh-request`; it resolves on the matching `bonobo:token` and rejects on
	 * the matching `bonobo:token-error`.
	 *
	 * @returns {Promise<string>}
	 */
	function refreshToken() {
		if (refresh_in_flight) {
			return refresh_in_flight;
		}
		const requestId = crypto.randomUUID();
		refresh_in_flight = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending_refreshes.delete(requestId);
				reject(new Error("Plugin page token refresh timed out"));
			}, REFRESH_DEADLINE_MS);
			pending_refreshes.set(requestId, { resolve, reject, timeout });
			try {
				window.parent.postMessage(
					{ type: "bonobo:token-refresh-request", bridgeNonce, requestId },
					parentOrigin,
				);
			} catch (error) {
				clearTimeout(timeout);
				pending_refreshes.delete(requestId);
				reject(error);
			}
		}).finally(() => {
			refresh_in_flight = null;
		});
		return refresh_in_flight;
	}

	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. When `init.body`
	 * is set it is JSON-encoded and sent with `Content-Type: application/json`, and the default
	 * method is `POST`; without a body the default method is `GET`. On a `401` the client
	 * refreshes the token and retries exactly once. Ok responses resolve with the parsed JSON
	 * body; non-ok responses throw an `Error` carrying `status` and `responseText`.
	 *
	 * @param {string} path - Public API path starting with `/`, e.g. `"/api/v1/files/list"`.
	 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [init]
	 * @returns {Promise<any>}
	 */
	async function fetchJson(path, init) {
		const has_body = init?.body !== undefined;
		/** @param {string} bearer */
		const send = (bearer) => {
			const headers = new Headers(init?.headers);
			headers.set("Authorization", `Bearer ${bearer}`);
			if (has_body) {
				headers.set("Content-Type", "application/json");
			}
			return fetch(apiOrigin + path, {
				method: init?.method ?? (has_body ? "POST" : "GET"),
				headers,
				body: has_body ? JSON.stringify(init.body) : undefined,
			});
		};

		const firstBearer = await getToken();
		let response = await send(firstBearer);
		if (response.status === 401) {
			// Another request may already have rotated this captured bearer. Reuse the current
			// token in that case so a late 401 cannot rotate the fresh token again.
			response = await send(token !== firstBearer ? token : await refreshToken());
		}
		if (!response.ok) {
			const responseText = await response.text();
			throw Object.assign(new Error(`${path} responded ${response.status}: ${responseText}`), {
				status: response.status,
				responseText,
			});
		}
		return response.json();
	}

	/**
	 * Shared plumbing for one correlated page->host request: registers `requestId` in `pending`,
	 * posts `message` to the host, and settles when the message handler resolves the entry.
	 * Rejects with `timeoutMessage` when the host does not answer within
	 * `DATA_REQUEST_DEADLINE_MS`, like an unanswered token refresh.
	 *
	 * @template T
	 * @param {Map<string, { resolve: (value: T) => void, timeout: ReturnType<typeof setTimeout> }>} pending
	 * @param {string} requestId
	 * @param {object} message
	 * @param {string} timeoutMessage
	 * @returns {Promise<T>}
	 */
	function post_correlated_request(pending, requestId, message, timeoutMessage) {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending.delete(requestId);
				reject(new Error(timeoutMessage));
			}, DATA_REQUEST_DEADLINE_MS);
			pending.set(requestId, { resolve, timeout });
			try {
				window.parent.postMessage(message, parentOrigin);
			} catch (error) {
				clearTimeout(timeout);
				pending.delete(requestId);
				reject(error);
			}
		});
	}

	/**
	 * Posts one `bonobo:data-user-write` and resolves with the correlated
	 * `bonobo:data-user-write-result` `result` as-is, `_yay` and `_nay` alike. The runtime passes
	 * the result through without checking it, so each caller casts this shared promise to its
	 * op's result type — that narrowing is the host-door contract, not a runtime guarantee.
	 *
	 * @param {{ op: "append" | "put" | "remove" | "putOwned" | "removeOwned", collection: string, keyPrefix?: string, key?: string, value?: object, clientRequestId?: string, expectedRevision?: number }} fields
	 */
	function post_data_user_write(fields) {
		const requestId = crypto.randomUUID();
		return post_correlated_request(
			pending_data_writes,
			requestId,
			{ type: "bonobo:data-user-write", bridgeNonce, requestId, ...fields },
			"Plugin data write timed out",
		);
	}

	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["data"]} */
	const data = {
		watch(opts, onUpdate) {
			const subscriptionId = crypto.randomUUID();
			watch_registrations.set(subscriptionId, { kind: "plain", deliver: onUpdate });
			window.parent.postMessage(
				{
					type: "bonobo:data-watch",
					bridgeNonce,
					subscriptionId,
					collection: opts.collection,
					...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
					limit: opts.limit,
				},
				parentOrigin,
			);
			return function unsubscribe() {
				// After a null update (or an earlier unsubscribe) the registration is already gone
				// and the host dropped its side too, so nothing must be posted again.
				if (!watch_registrations.delete(subscriptionId)) {
					return;
				}
				window.parent.postMessage({ type: "bonobo:data-unwatch", bridgeNonce, subscriptionId }, parentOrigin);
			};
		},
		watchWindow(opts, onUpdate) {
			const subscriptionId = crypto.randomUUID();
			watch_registrations.set(subscriptionId, { kind: "window", deliver: onUpdate });
			window.parent.postMessage(
				{
					type: "bonobo:data-watch-window",
					bridgeNonce,
					subscriptionId,
					collection: opts.collection,
					...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
					pageSize: opts.pageSize,
				},
				parentOrigin,
			);
			return {
				loadOlder() {
					// A dead or unsubscribed window posts nothing; the host would ignore it anyway.
					if (!watch_registrations.has(subscriptionId)) {
						return;
					}
					window.parent.postMessage(
						{ type: "bonobo:data-window-load-older", bridgeNonce, subscriptionId },
						parentOrigin,
					);
				},
				unsubscribe() {
					// Same discipline as the plain watch's unsubscribe above.
					if (!watch_registrations.delete(subscriptionId)) {
						return;
					}
					window.parent.postMessage({ type: "bonobo:data-unwatch", bridgeNonce, subscriptionId }, parentOrigin);
				},
			};
		},
		append(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataAppendResult>} */ (
				post_data_user_write({
					op: "append",
					collection: opts.collection,
					...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
					value: opts.value,
					...(opts.clientRequestId === undefined ? {} : { clientRequestId: opts.clientRequestId }),
				})
			);
		},
		put(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataPutResult>} */ (
				post_data_user_write({
					op: "put",
					collection: opts.collection,
					key: opts.key,
					value: opts.value,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
		remove(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataRemoveResult>} */ (
				post_data_user_write({
					op: "remove",
					collection: opts.collection,
					key: opts.key,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
		putOwned(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataPutOwnedResult>} */ (
				post_data_user_write({
					op: "putOwned",
					collection: opts.collection,
					key: opts.key,
					value: opts.value,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
		removeOwned(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataRemoveResult>} */ (
				post_data_user_write({
					op: "removeOwned",
					collection: opts.collection,
					key: opts.key,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
	};

	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["members"]} */
	const members = {
		resolve(userIds) {
			const requestId = crypto.randomUUID();
			return post_correlated_request(
				pending_member_resolves,
				requestId,
				{ type: "bonobo:data-resolve-members", bridgeNonce, requestId, userIds },
				"Plugin member resolve timed out",
			);
		},
	};

	/** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>} */
	const client_promise = new Promise((resolve) => {
		let initialized = false;
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let readyInterval;

		const post_ready = () => {
			window.parent.postMessage({ type: "bonobo:ready", bridgeNonce }, parentOrigin);
		};

		const stop_ready = () => {
			clearInterval(readyInterval);
		};

		/** @param {MessageEvent} event */
		const handle_message = (event) => {
			if (event.source !== window.parent || event.origin !== parentOrigin) {
				return;
			}
			const message = event.data;
			if (typeof message !== "object" || message === null) {
				return;
			}
			if (
				message.type === "bonobo:init" &&
				!initialized &&
				message.bridgeNonce === bridgeNonce &&
				typeof message.apiOrigin === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt) &&
				is_ui_context(message.context)
			) {
				initialized = true;
				stop_ready();
				window.removeEventListener("pagehide", stop_ready);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				resolve({ context: message.context, apiOrigin, getToken, refreshToken, fetchJson, data, members });
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:token" &&
				typeof message.requestId === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt)
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					token = message.token;
					tokenExpiresAt = message.tokenExpiresAt;
					pending.resolve(message.token);
				}
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:token-error" &&
				typeof message.requestId === "string" &&
				typeof message.message === "string"
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.reject(new Error(message.message));
				}
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:data-update" &&
				typeof message.subscriptionId === "string" &&
				(message.docs === null || Array.isArray(message.docs))
			) {
				const registration = watch_registrations.get(message.subscriptionId);
				if (registration) {
					// A null update means the host killed the subscription and already dropped it.
					// Deliver the null once and drop the registration, so a later unsubscribe is a
					// no-op and later updates for this id are ignored. The host may say why it
					// refused (`reason`/`message`); pass that along without requiring it.
					if (message.docs === null) {
						watch_registrations.delete(message.subscriptionId);
						// Pass the info argument only when the host explained the death, so a bare
						// death keeps delivering exactly one argument like it did before 0.8.0.
						const info = {
							...(typeof message.reason === "string" ? { reason: message.reason } : {}),
							...(typeof message.message === "string" ? { message: message.message } : {}),
						};
						if (Object.keys(info).length > 0) {
							registration.deliver(null, info);
						} else {
							registration.deliver(null);
						}
					} else if (registration.kind === "window") {
						registration.deliver({
							docs: message.docs,
							hasMore: message.hasMore === true,
							atCapacity: message.atCapacity === true,
							incomplete: message.incomplete === true,
						});
					} else {
						registration.deliver(message.docs);
					}
				}
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:data-user-write-result" &&
				typeof message.requestId === "string" &&
				typeof message.result === "object" &&
				message.result !== null
			) {
				const pending = pending_data_writes.get(message.requestId);
				if (pending) {
					pending_data_writes.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.resolve(message.result);
				}
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:data-resolve-members-result" &&
				typeof message.requestId === "string" &&
				typeof message.members === "object" &&
				message.members !== null
			) {
				const pending = pending_member_resolves.get(message.requestId);
				if (pending) {
					pending_member_resolves.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.resolve(message.members);
				}
			}
			// Anything else (unknown types, replayed inits, stray requestIds or subscriptionIds) is
			// silently ignored.
		};

		window.addEventListener("message", handle_message);
		window.addEventListener("pagehide", stop_ready, { once: true });
		post_ready();
		readyInterval = setInterval(post_ready, READY_RETRY_MS);
	});

	return client_promise;
}
