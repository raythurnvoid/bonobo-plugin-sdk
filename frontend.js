/**
 * Bonobo plugin frontend bridge — hand-written browser ESM, no dependencies, no build step.
 *
 * Runs inside the host app's sandboxed plugin-page iframe (`sandbox="allow-scripts"`, so the
 * document has an opaque origin) and talks to the embedding host app over the v1 postMessage
 * protocol: the page announces `bonobo:ready`, the host answers `bonobo:init` with a short-lived
 * scoped bearer token, and the client then calls the public `/api/v1/*` API on `apiOrigin`
 * directly with `Authorization: Bearer <token>`.
 */

const PROTOCOL_VERSION = 1;

/** `getToken` refreshes when the token is expired or expires within this margin. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/**
 * Connects the page to the embedding host app: installs one shared `message` listener (init and
 * token responses), posts `{ type: "bonobo:ready", protocolVersion: 1 }` to `window.parent`, and
 * resolves with the frontend client when the host's `bonobo:init` (protocol v1) arrives.
 * `bonobo:init` messages after the first are ignored.
 *
 * Reads `parentOrigin` and `pageId` from the query params the host appends to the iframe URL,
 * and throws when `parentOrigin` is missing — the page was not embedded by the Bonobo host app.
 *
 * Security: outgoing messages are posted to `window.parent` with `targetOrigin: parentOrigin`
 * exactly; incoming messages are accepted only when `event.origin === parentOrigin` and
 * `event.source === window.parent`, and everything else — including unknown `type` values — is
 * silently ignored. The token travels over postMessage only and is never placed in a URL.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>}
 */
export async function bonobo_ui_connect() {
	const query = new URLSearchParams(window.location.search);
	const parentOrigin = query.get("parentOrigin");
	// Also in the URL, but the `bonobo:init` context carries the authoritative copy.
	const pageId = query.get("pageId");
	if (!parentOrigin) {
		throw new Error("Missing parentOrigin query param — the page must be embedded by the Bonobo host app");
	}

	// Token state — set by `bonobo:init`, updated by `bonobo:token`.
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;

	/** @type {Map<string, { resolve: (token: string) => void, reject: (error: Error) => void }>} */
	const pending_refreshes = new Map();
	/** @type {Promise<string> | null} */
	let refresh_in_flight = null;

	/**
	 * Returns the current token, transparently refreshing first when it is expired or within
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
	 * Asks the host for a fresh token. Single-flight: concurrent callers share one in-flight
	 * `bonobo:token-refresh-request`, resolved by the matching `bonobo:token` and rejected by the
	 * matching `bonobo:token-error`.
	 *
	 * @returns {Promise<string>}
	 */
	function refreshToken() {
		if (refresh_in_flight) {
			return refresh_in_flight;
		}
		const requestId = crypto.randomUUID();
		refresh_in_flight = new Promise((resolve, reject) => {
			pending_refreshes.set(requestId, { resolve, reject });
			window.parent.postMessage({ type: "bonobo:token-refresh-request", requestId }, parentOrigin);
		}).finally(() => {
			refresh_in_flight = null;
		});
		return refresh_in_flight;
	}

	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. An `init.body`
	 * object is JSON-encoded with `Content-Type: application/json` (default method `POST`;
	 * without a body the default is `GET`). On a `401` the client refreshes the token and retries
	 * exactly once. Resolves with the parsed JSON body of ok responses; non-ok responses throw an
	 * `Error` carrying `status` and `responseText`.
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
			// Exactly one transparent retry — the host may have rotated or revoked the token.
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
	const client_promise = new Promise((resolve) => {
		let initialized = false;
		window.addEventListener("message", (event) => {
			// Trust only the embedding host app: exact origin pin plus the direct parent window.
			if (event.origin !== parentOrigin || event.source !== window.parent) {
				return;
			}
			const message = event.data;
			if (typeof message !== "object" || message === null) {
				return;
			}
			if (message.type === "bonobo:init" && message.protocolVersion === PROTOCOL_VERSION && !initialized) {
				initialized = true;
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				resolve({ context: message.context, apiOrigin, getToken, refreshToken, fetchJson });
			} else if (message.type === "bonobo:token") {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					token = message.token;
					tokenExpiresAt = message.tokenExpiresAt;
					pending.resolve(message.token);
				}
			} else if (message.type === "bonobo:token-error") {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					pending.reject(new Error(message.message));
				}
			}
			// Anything else (unknown types, replayed inits, stray requestIds) is silently ignored.
		});
	});

	window.parent.postMessage({ type: "bonobo:ready", protocolVersion: PROTOCOL_VERSION }, parentOrigin);
	return client_promise;
}
