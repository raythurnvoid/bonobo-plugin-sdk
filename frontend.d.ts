import type { BonoboPublicDoc } from "bonobo-plugin-sdk";

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
 * Sent by the page to `window.parent` to ask for a fresh session token. The host answers with a
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
	/** Id of the member viewing this frame. `putOwned`/`removeOwned` stored keys end with it. */
	userId: string;
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
	/** Id of the member viewing this frame. `putOwned`/`removeOwned` stored keys end with it. */
	userId: string;
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
 * The host's answer to {@link BonoboUiReadyMessage}: it delivers the short-lived scoped session
 * token (`plu_...`), the Convex deployment URL the page's own client connects to, and the
 * embedding context. The init is trusted only from `window.parent`, the exact `parentOrigin`
 * from the URL fragment, and the matching frame nonce. The token travels over postMessage only
 * and is never placed in a URL. `tokenExpiresAt` is Unix epoch milliseconds.
 */
export interface BonoboUiInitMessage {
	type: "bonobo:init";
	bridgeNonce: string;
	apiOrigin: string;
	/**
	 * The Convex deployment URL. The SDK opens its own Convex client against it and
	 * authenticates with plugin-session JWTs minted from the session token, so the `data` and
	 * `members` APIs run without the host window in the path.
	 */
	convexUrl: string;
	token: string;
	tokenExpiresAt: number;
	context: BonoboUiContext;
}

/**
 * The host's success answer to {@link BonoboUiTokenRefreshRequestMessage} — a fresh session
 * token. The refresh also extends the session's life on the server. `tokenExpiresAt` is Unix
 * epoch milliseconds.
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
 * Why a subscription died, when the SDK could say. `reason` is `"invalid"` when the watch inputs
 * failed the client-side checks, and `"capacity"` when the page holds too many live
 * subscriptions (close one first). A death without a reason means access is gone or the query
 * failed on the server.
 */
export interface BonoboUiWatchDeathInfo {
	reason?: string;
	message?: string;
}

/**
 * One non-null `data.watchWindow` update. `docs` replaces the whole flattened window, ordered by
 * key. `hasMore` says older docs exist below the window (`loadOlder` fetches them). `atCapacity`
 * says the window cannot grow right now — its interval budget or the page's subscription budget
 * is spent. `incomplete` says docs are missing in the middle of the window because an overflowing
 * range could not be re-read; treat the list as gapped, not merely short.
 */
export interface BonoboUiDataWindowUpdate {
	docs: BonoboPublicDoc[];
	hasMore: boolean;
	atCapacity: boolean;
	incomplete: boolean;
}

/**
 * Per-operation write results, exactly the shapes the store's five write doors answer.
 * `_nay.name` is `"conflict"` for revision, ownership, and key conflicts, and `"storage_full"`
 * when the store is out of capacity; other refusals carry only a message.
 */
export type BonoboUiDataWriteNay = { _nay: { name?: string; message: string } };
export type BonoboUiDataAppendResult = { _yay: { key: string; revision: number; byteSize: number } } | BonoboUiDataWriteNay;
export type BonoboUiDataPutResult = { _yay: { revision: number; byteSize: number } } | BonoboUiDataWriteNay;
export type BonoboUiDataPutOwnedResult =
	| { _yay: { key: string; revision: number; byteSize: number } }
	| BonoboUiDataWriteNay;
export type BonoboUiDataRemoveResult = { _yay: { deleted: boolean } } | BonoboUiDataWriteNay;

/** The result of one data write — the union of the per-operation shapes above. */
export type BonoboUiDataWriteResult =
	| BonoboUiDataAppendResult
	| BonoboUiDataPutResult
	| BonoboUiDataPutOwnedResult
	| BonoboUiDataRemoveResult;

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
	 * Returns the current session token, refreshing it first when it is expired or within 60
	 * seconds of `tokenExpiresAt`.
	 */
	getToken(): Promise<string>;
	/**
	 * Asks the host for a fresh session token ({@link BonoboUiTokenRefreshRequestMessage}).
	 * Concurrent callers share one in-flight request. Rejects when the host answers with
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
	 * Pagination: with `contentTypePrefixes`, one `/api/v1/files/list` request uses one bounded
	 * query. `scanLimit` sets its source-doc budget; the server defaults and caps it at 10,000 docs.
	 * The query does not set a byte-read cap. A page may come back short or even empty while
	 * `isDone` is still `false`.
	 * Scan with `limit: 100`, `scanLimit: 10000`, and `kind: "file"`. Advance a bounded number
	 * of requests per user action (say 30), keep `cursor` across actions, buffer items fetched
	 * beyond what is shown, and retry a `429` on the same cursor — the page is not lost.
	 */
	fetchJson(path: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): Promise<any>;
	/**
	 * The plugin's own document store, on the page's own Convex client. Reads are reactive
	 * Convex subscriptions; writes run as the viewing member, attributed to the session's user.
	 * Every write RESOLVES with a {@link BonoboUiDataWriteResult} — `_nay` resolves too, and a
	 * failed call (network loss, an unserializable payload) resolves the stable
	 * `{ _nay: { message: "Failed to write plugin data" } }` instead of rejecting.
	 */
	data: {
		/**
		 * Opens one reactive subscription on `collection` (optionally narrowed to keys starting
		 * with `keyPrefix`). `onUpdate` receives the subscription's whole current window each time
		 * — replace, do not accumulate — and `null` exactly once when the subscription dies. The
		 * death may carry a {@link BonoboUiWatchDeathInfo} explaining why; a bare `null` means
		 * access is gone. After a `null` the registration is gone. Returns an unsubscribe
		 * function; calling it after a `null` update, or a second time, is a no-op.
		 *
		 * `limit` must be an integer from 1 to 100 — an out-of-range limit kills the
		 * subscription at birth with `reason: "invalid"`, nothing is clamped. The SDK allows at
		 * most 8 active subscriptions per page (plain watches and windows share those slots);
		 * one more dies at birth with `reason: "capacity"`.
		 */
		watch(
			opts: { collection: string; keyPrefix?: string; limit: number },
			onUpdate: (docs: BonoboPublicDoc[] | null, info?: BonoboUiWatchDeathInfo) => void,
		): () => void;
		/**
		 * Opens one reactive document WINDOW on `collection` (optionally narrowed to `keyPrefix`).
		 * Unlike `watch`, a window RETAINS loaded history: new arrivals grow it instead of pushing
		 * older docs out, and `loadOlder()` extends it one `pageSize` further into older keys while
		 * `hasMore` is true. `onUpdate` receives the whole flattened window each time
		 * ({@link BonoboUiDataWindowUpdate}), and `null` exactly once when the window dies — same
		 * death contract as `watch`. A window can hold up to 6 internal reads (600 docs at
		 * `pageSize` 100); past that it reports `atCapacity` instead of growing.
		 */
		watchWindow(
			opts: { collection: string; keyPrefix?: string; pageSize: number },
			onUpdate: (update: BonoboUiDataWindowUpdate | null, info?: BonoboUiWatchDeathInfo) => void,
		): { unsubscribe: () => void; loadOlder: () => void };
		/**
		 * Creates a document under a server-generated key starting with `keyPrefix`. Pass the same
		 * `clientRequestId` when retrying so a replayed append answers the stored key instead of
		 * writing twice.
		 */
		append(opts: {
			collection: string;
			keyPrefix?: string;
			value: object;
			clientRequestId?: string;
		}): Promise<BonoboUiDataAppendResult>;
		/**
		 * Writes `value` under exactly `key`, creating or replacing the document. With
		 * `expectedRevision`, the write happens only when the stored document still has that
		 * revision — pass the `revision` you read; `0` means "the key must not exist yet". A
		 * mismatch answers `_nay` with `name: "conflict"`; re-read and decide again.
		 */
		put(opts: {
			collection: string;
			key: string;
			value: object;
			expectedRevision?: number;
		}): Promise<BonoboUiDataPutResult>;
		/**
		 * Removes the document stored under exactly `key`. With `expectedRevision`, the remove
		 * happens only at that revision, and an already-absent key answers `deleted: false` only
		 * for `expectedRevision` 0 or none — expecting a live revision of a gone document is a
		 * conflict.
		 */
		remove(opts: { collection: string; key: string; expectedRevision?: number }): Promise<BonoboUiDataRemoveResult>;
		/**
		 * Writes a document only its author may change. The store keeps it under the key
		 * `<key>:<userId>`, using the viewing member's `userId` from the init context. The stored
		 * key must fit the 128-character key limit, so `key` may be at most
		 * `128 - userId.length - 1` characters. `expectedRevision` works like `put`, judged
		 * against this member's own document at the composed key.
		 */
		putOwned(opts: {
			collection: string;
			key: string;
			value: object;
			expectedRevision?: number;
		}): Promise<BonoboUiDataPutOwnedResult>;
		/**
		 * Removes this member's own document stored under `<key>:<userId>` — the same stored-key
		 * contract and key budget as `putOwned`, and the same `expectedRevision` rule as `remove`.
		 */
		removeOwned(opts: {
			collection: string;
			key: string;
			expectedRevision?: number;
		}): Promise<BonoboUiDataRemoveResult>;
	};
	/** Member-name resolution on the page's own Convex client. */
	members: {
		/**
		 * Resolves up to 50 user ids to display names. A missing or deleted user maps to `null`.
		 * A denied or failed query resolves an empty map; the call never rejects.
		 */
		resolve(userIds: string[]): Promise<Record<string, string | null>>;
	};
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
 * On init the SDK opens the page's own Convex client against the init's `convexUrl` and closes
 * it on `pagehide` — a page restored from the browser's back/forward cache stays frozen and
 * needs a reload. The client authenticates with short-lived plugin-session JWTs minted by
 * exchanging the session token at the same-origin `/plugins-ui/session-jwt` route. The exchange
 * itself never extends the session; it stays alive because the SDK refreshes the session token
 * through the host, and that host refresh extends it.
 *
 * Every incoming message requires that origin, `window.parent`, and the fragment nonce;
 * everything else is silently ignored.
 */
export function bonobo_ui_connect(): Promise<BonoboUiFrontendClient>;
