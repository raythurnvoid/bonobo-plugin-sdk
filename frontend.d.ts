/**
 * Sent by the page to `window.parent` at the exact `parentOrigin` from the URL fragment once the
 * connect listener is installed. It tells the host this frame is ready to receive
 * {@link BonoboUiInitMessage} and proves it read the frame's bootstrap nonce.
 */
export interface BonoboUiReadyMessage {
	type: "bonobo:ready";
	bridgeNonce: string;
}

/**
 * Sent by the page to `window.parent` to ask for a fresh token. The host answers with a
 * {@link BonoboUiTokenMessage} or {@link BonoboUiTokenErrorMessage} echoing `requestId`.
 */
export interface BonoboUiTokenRefreshRequestMessage {
	type: "bonobo:token-refresh-request";
	bridgeNonce: string;
	requestId: string;
}

/** `context` of {@link BonoboUiInitMessage} when a plugin page is embedded. */
export interface BonoboUiPageContext {
	kind: "page";
	pluginName: string;
	pageId: string;
	pageTitle: string;
	organizationId: string;
	workspaceId: string;
}

/**
 * `context` of {@link BonoboUiInitMessage} when a plugin file view is embedded — the host opened
 * this frame for one stored file whose content type matched the view's declared list.
 */
export interface BonoboUiFileViewContext {
	kind: "file_view";
	pluginName: string;
	fileViewId: string;
	fileViewTitle: string;
	organizationId: string;
	workspaceId: string;
	/** The stored file the view was opened for. `contentType` is the matched stored content type. */
	file: {
		fileNodeId: string;
		name: string;
		path: string;
		contentType: string;
	};
}

/** `context` of {@link BonoboUiInitMessage} — discriminated by `kind`. */
export type BonoboUiContext = BonoboUiPageContext | BonoboUiFileViewContext;

/**
 * The host's answer to {@link BonoboUiReadyMessage}: it delivers the short-lived scoped bearer
 * token (`plu_...`) and the embedding context. The init is trusted only from `window.parent`, the
 * exact `parentOrigin` from the URL fragment, and the matching frame nonce. The token travels
 * over postMessage only and is never placed in a URL. `tokenExpiresAt` is Unix epoch milliseconds.
 */
export interface BonoboUiInitMessage {
	type: "bonobo:init";
	bridgeNonce: string;
	apiOrigin: string;
	token: string;
	tokenExpiresAt: number;
	context: BonoboUiContext;
}

/**
 * The host's success answer to {@link BonoboUiTokenRefreshRequestMessage} — a fresh token.
 * `tokenExpiresAt` is Unix epoch milliseconds.
 */
export interface BonoboUiTokenMessage {
	type: "bonobo:token";
	bridgeNonce: string;
	requestId: string;
	token: string;
	tokenExpiresAt: number;
}

/** The host's failure answer to {@link BonoboUiTokenRefreshRequestMessage}. */
export interface BonoboUiTokenErrorMessage {
	type: "bonobo:token-error";
	bridgeNonce: string;
	requestId: string;
	message: string;
}

/**
 * The connected plugin frontend client resolved by {@link bonobo_ui_connect}, for plugin pages
 * and plugin file views alike. With the `workspace.files.read` capability the UI token carries
 * the `files:list`, `files:read`, and `files:download` scopes for `POST /api/v1/files/list`,
 * `POST /api/v1/files/read`, and `POST /api/v1/files/download-urls`. UI tokens are always
 * rejected on `/api/v1/files/write`.
 */
export interface BonoboUiFrontendClient {
	/** The {@link BonoboUiInitMessage} context. Narrow on `context.kind` before using kind-specific fields. */
	context: BonoboUiContext;
	/** Origin of the public host API — `fetchJson` prefixes it onto `path`. */
	apiOrigin: string;
	/**
	 * Returns the current bearer token, refreshing it first when it is expired or within 60
	 * seconds of `tokenExpiresAt`.
	 */
	getToken(): Promise<string>;
	/**
	 * Asks the host for a fresh token ({@link BonoboUiTokenRefreshRequestMessage}). Concurrent
	 * callers share one in-flight request. Rejects when the host answers with
	 * {@link BonoboUiTokenErrorMessage} or does not answer within 10 seconds.
	 */
	refreshToken(): Promise<string>;
	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. When `init.body`
	 * is set it is JSON-encoded and sent with `Content-Type: application/json`, and the default
	 * method is `POST`; without a body the default method is `GET`. On a `401` the client
	 * refreshes the token and retries exactly once. Ok responses resolve with the parsed JSON
	 * body; non-ok responses throw an `Error` carrying `status` and `responseText`.
	 *
	 * Pagination: with `contentTypePrefixes`, `/api/v1/files/list` filters each page after
	 * pagination, so a page may come back short or even empty while `isDone` is still `false`.
	 * Scan with `limit: 100` and `kind: "file"`, advance a bounded number of source pages per
	 * user action (say 30), keep `cursor` across actions, buffer items fetched beyond what is
	 * shown, and retry a `429` on the same cursor — the page is not lost.
	 */
	fetchJson(path: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): Promise<any>;
}

/**
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts {@link BonoboUiReadyMessage} to `window.parent`, and resolves
 * with the client when the host's {@link BonoboUiInitMessage} arrives.
 * `bonobo:init` messages after the first are ignored.
 *
 * The URL fragment must contain one canonical HTTP(S) `parentOrigin` and one UUIDv4
 * `bridgeNonce`. Fragments are not sent in the asset request, cache key, or referrer. Ready
 * messages carry the nonce, target only that parent origin, and retry until the host answers or
 * the document unloads. The host owns the startup deadline and replaces a failed frame; the SDK
 * does not run a competing timeout.
 *
 * Every incoming message requires that origin, `window.parent`, and the fragment nonce;
 * everything else is silently ignored.
 */
export function bonobo_ui_connect(): Promise<BonoboUiFrontendClient>;
