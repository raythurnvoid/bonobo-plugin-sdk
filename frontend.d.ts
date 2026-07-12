/**
 * Sent by the page to `window.parent` (targetOrigin pinned to `parentOrigin`) once the connect
 * listener is installed — tells the host the page is ready to receive {@link BonoboUiInitMessage}.
 */
export interface BonoboUiReadyMessage {
	type: "bonobo:ready";
	protocolVersion: 1;
}

/**
 * Sent by the page to `window.parent` to ask for a fresh token. The host answers with a
 * {@link BonoboUiTokenMessage} or {@link BonoboUiTokenErrorMessage} echoing `requestId`.
 */
export interface BonoboUiTokenRefreshRequestMessage {
	type: "bonobo:token-refresh-request";
	requestId: string;
}

/** `context` of {@link BonoboUiInitMessage} — which plugin page is embedded and for which workspace. */
export interface BonoboUiPageContext {
	pluginName: string;
	pageId: string;
	pageTitle: string;
	organizationId: string;
	workspaceId: string;
}

/**
 * The host's answer to {@link BonoboUiReadyMessage} — delivers the short-lived scoped bearer
 * token (`plu_...`) and the page context. Like every host → page message, it is trusted only
 * when `event.origin === parentOrigin && event.source === window.parent`; the token travels over
 * postMessage only and is never placed in a URL. `tokenExpiresAt` is Unix epoch milliseconds.
 */
export interface BonoboUiInitMessage {
	type: "bonobo:init";
	protocolVersion: 1;
	apiOrigin: string;
	token: string;
	tokenExpiresAt: number;
	context: BonoboUiPageContext;
}

/**
 * The host's success answer to {@link BonoboUiTokenRefreshRequestMessage} — a fresh token.
 * `tokenExpiresAt` is Unix epoch milliseconds.
 */
export interface BonoboUiTokenMessage {
	type: "bonobo:token";
	requestId: string;
	token: string;
	tokenExpiresAt: number;
}

/** The host's failure answer to {@link BonoboUiTokenRefreshRequestMessage}. */
export interface BonoboUiTokenErrorMessage {
	type: "bonobo:token-error";
	requestId: string;
	message: string;
}

/**
 * The connected plugin-page client resolved by {@link bonobo_ui_connect}. With the
 * `workspace.files.read` capability the UI token carries the `files:list`, `files:read`, and
 * `files:download` scopes for `POST /api/v1/files/list`, `POST /api/v1/files/read`, and
 * `POST /api/v1/files/download-url`; UI tokens are rejected on `/api/v1/files/write`.
 */
export interface BonoboUiFrontendClient {
	/** The {@link BonoboUiInitMessage} context. */
	context: BonoboUiPageContext;
	/** Origin of the public host API — `fetchJson` prefixes it onto `path`. */
	apiOrigin: string;
	/**
	 * Resolves the current bearer token, transparently refreshing first when it is expired or
	 * within 60 seconds of `tokenExpiresAt`.
	 */
	getToken(): Promise<string>;
	/**
	 * Asks the host for a fresh token ({@link BonoboUiTokenRefreshRequestMessage}). Single-flight:
	 * concurrent callers share one in-flight request; rejects on {@link BonoboUiTokenErrorMessage}.
	 */
	refreshToken(): Promise<string>;
	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. An `init.body`
	 * object is JSON-encoded with `Content-Type: application/json` (default method `POST`;
	 * without a body the default is `GET`). On a `401` the client refreshes the token and retries
	 * exactly once. Resolves with the parsed JSON body of ok responses; non-ok responses throw an
	 * `Error` carrying `status` and `responseText`.
	 *
	 * Pagination: with `contentTypePrefixes`, `/api/v1/files/list` post-filters each page after
	 * pagination, so a page may come back short or even empty while `isDone` is still `false` —
	 * keep passing `cursor` until `isDone` is `true` or you have enough items.
	 */
	fetchJson(path: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): Promise<any>;
}

/**
 * Connects the page to the embedding host app: installs one shared `message` listener (init and
 * token responses), posts {@link BonoboUiReadyMessage} to `window.parent`, and resolves with the
 * client when the host's {@link BonoboUiInitMessage} (protocol v1) arrives. `bonobo:init`
 * messages after the first are ignored.
 *
 * Reads `parentOrigin` and `pageId` from the query params the host appends to the iframe URL,
 * and throws when `parentOrigin` is missing — the page was not embedded by the Bonobo host app.
 *
 * Security: outgoing messages are posted to `window.parent` with `targetOrigin: parentOrigin`
 * exactly; incoming messages are accepted only when `event.origin === parentOrigin` and
 * `event.source === window.parent`, and everything else — including unknown `type` values — is
 * silently ignored.
 */
export function bonobo_ui_connect(): Promise<BonoboUiFrontendClient>;
