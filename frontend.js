/**
 * Bonobo plugin frontend bridge — hand-written browser ESM, no dependencies, no build step.
 *
 * Runs inside the host app's sandboxed plugin-page iframe (`sandbox="allow-scripts"`, so the
 * document has an opaque origin) and talks to the embedding host app over the current strict
 * postMessage contract: the page announces `bonobo:ready`, the host answers `bonobo:init` with a
 * short-lived scoped bearer token, and from then on the client calls the public `/api/v1/*` API
 * on `apiOrigin` directly with `Authorization: Bearer <token>`.
 */

/** `getToken` refreshes when the token is expired or expires within this margin. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const READY_RETRY_MS = 500;
const REFRESH_DEADLINE_MS = 10_000;
const BRIDGE_NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {unknown} value */
function is_page_context(value) {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const context = /** @type {Record<string, unknown>} */ (value);
	return (
		typeof context.pluginName === "string" &&
		typeof context.pageId === "string" &&
		typeof context.pageTitle === "string" &&
		typeof context.organizationId === "string" &&
		typeof context.workspaceId === "string"
	);
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
 * init and token responses), posts `{ type: "bonobo:ready", bridgeNonce }` to `window.parent`,
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
				is_page_context(message.context)
			) {
				initialized = true;
				stop_ready();
				window.removeEventListener("pagehide", stop_ready);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				resolve({ context: message.context, apiOrigin, getToken, refreshToken, fetchJson });
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
			}
			// Anything else (unknown types, replayed inits, stray requestIds) is silently ignored.
		};

		window.addEventListener("message", handle_message);
		window.addEventListener("pagehide", stop_ready, { once: true });
		post_ready();
		readyInterval = setInterval(post_ready, READY_RETRY_MS);
	});

	return client_promise;
}
