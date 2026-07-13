/**
 * Bonobo plugin frontend bridge — hand-written browser ESM, no dependencies, no build step.
 *
 * Runs inside the host app's sandboxed plugin-page iframe (`sandbox="allow-scripts"`, so the
 * document has an opaque origin) and talks to the embedding host app over the v2 postMessage
 * protocol: the page announces `bonobo:ready`, the host answers `bonobo:init` with a
 * short-lived scoped bearer token, and from then on the client calls the public `/api/v1/*` API
 * on `apiOrigin` directly with `Authorization: Bearer <token>`.
 */

const PROTOCOL_VERSION = 2;

/** `getToken` refreshes when the token is expired or expires within this margin. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const CONNECTION_DEADLINE_MS = 14_000;
const READY_RETRY_MS = 500;
const READY_ATTEMPTS = 20;
const REFRESH_DEADLINE_MS = 10_000;

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
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts `{ type: "bonobo:ready", protocolVersion: 2 }` to
 * `window.parent`, and resolves with the frontend client when the host's `bonobo:init`
 * (protocol v2) arrives. `bonobo:init` messages after the first are ignored.
 *
 * Reads `parentOrigin` and `bridgeNonce` from the query params the host appends to the iframe
 * URL, and throws when either is missing.
 *
 * Security: outgoing messages are posted to `window.parent` with exactly
 * `targetOrigin: parentOrigin`. Incoming messages are accepted only when
 * `event.origin === parentOrigin` and `event.source === window.parent`; everything else —
 * including unknown `type` values — is silently ignored. The token travels over postMessage
 * only and is never placed in a URL.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>}
 */
export async function bonobo_ui_connect() {
	const query = new URLSearchParams(window.location.search);
	const parentOriginParam = query.get("parentOrigin");
	const bridgeNonceParam = query.get("bridgeNonce");
	if (!parentOriginParam || !bridgeNonceParam) {
		throw new Error("Missing host bridge query params — the page must be embedded by the Bonobo host app");
	}
	const parentOrigin = parentOriginParam;
	const bridgeNonce = bridgeNonceParam;

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
					{ type: "bonobo:token-refresh-request", protocolVersion: PROTOCOL_VERSION, bridgeNonce, requestId },
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

		let response = await send(await getToken());
		if (response.status === 401) {
			// Retry exactly once: the host may have rotated or revoked the token.
			response = await send(await refreshToken());
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
	const client_promise = new Promise((resolve, reject) => {
		let initialized = false;
		let readyAttempts = 0;
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let readyInterval;
		/** @type {ReturnType<typeof setTimeout> | undefined} */
		let connectionDeadline;

		const post_ready = () => {
			readyAttempts += 1;
			window.parent.postMessage(
				{ type: "bonobo:ready", protocolVersion: PROTOCOL_VERSION, bridgeNonce },
				parentOrigin,
			);
		};

		/** @param {MessageEvent} event */
		const handle_message = (event) => {
			// Trust only the embedding host app: the exact origin and the direct parent window must both match.
			if (event.origin !== parentOrigin || event.source !== window.parent) {
				return;
			}
			const message = event.data;
			if (typeof message !== "object" || message === null) {
				return;
			}
			if (message.protocolVersion !== PROTOCOL_VERSION || message.bridgeNonce !== bridgeNonce) {
				return;
			}
			if (
				message.type === "bonobo:init" &&
				!initialized &&
				typeof message.apiOrigin === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt) &&
				is_page_context(message.context)
			) {
				initialized = true;
				clearInterval(readyInterval);
				clearTimeout(connectionDeadline);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				resolve({ context: message.context, apiOrigin, getToken, refreshToken, fetchJson });
			} else if (
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
		post_ready();
		readyInterval = setInterval(() => {
			if (readyAttempts >= READY_ATTEMPTS) {
				clearInterval(readyInterval);
				return;
			}
			post_ready();
		}, READY_RETRY_MS);
		connectionDeadline = setTimeout(() => {
			clearInterval(readyInterval);
			window.removeEventListener("message", handle_message);
			reject(new Error("Plugin page connection timed out"));
		}, CONNECTION_DEADLINE_MS);
	});

	return client_promise;
}
