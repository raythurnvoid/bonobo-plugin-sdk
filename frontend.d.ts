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
 * Sent by the page to `window.parent` to open one reactive plugin-data subscription. The host
 * answers with {@link BonoboUiDataUpdateMessage} messages echoing `subscriptionId` — first the
 * current window, then again whenever it changes. The host caps `limit` at 100 and allows at most
 * 8 active watches per frame; one more answers a `null` update and the subscription is dead.
 */
export interface BonoboUiDataWatchMessage {
	type: "bonobo:data-watch";
	bridgeNonce: string;
	subscriptionId: string;
	collection: string;
	keyPrefix?: string;
	limit: number;
}

/**
 * Sent by the page to `window.parent` to open one reactive document WINDOW — a subscription that
 * retains loaded history instead of sliding older docs out of a capped read. The host answers
 * with {@link BonoboUiDataUpdateMessage} messages carrying `hasMore`, `atCapacity`, and
 * `incomplete` beside `docs`. `pageSize` (1..100) is how many docs each internal read fetches;
 * a window may hold several such reads. A window occupies one of the same 8 watch slots a plain
 * watch uses.
 */
export interface BonoboUiDataWatchWindowMessage {
	type: "bonobo:data-watch-window";
	bridgeNonce: string;
	subscriptionId: string;
	collection: string;
	keyPrefix?: string;
	pageSize: number;
}

/**
 * Sent by the page to `window.parent` to extend a window one page further into older keys. The
 * host answers with a normal {@link BonoboUiDataUpdateMessage} when the extension delivers, or
 * with `atCapacity: true` when the window cannot grow right now.
 */
export interface BonoboUiDataWindowLoadOlderMessage {
	type: "bonobo:data-window-load-older";
	bridgeNonce: string;
	subscriptionId: string;
}

/** Sent by the page to `window.parent` to close one subscription. The host stops sending its updates. */
export interface BonoboUiDataUnwatchMessage {
	type: "bonobo:data-unwatch";
	bridgeNonce: string;
	subscriptionId: string;
}

/**
 * Sent by the page to `window.parent` to write the plugin's document store as the viewing member.
 * Which of `keyPrefix`, `key`, `value`, and `clientRequestId` are present depends on `op` — see
 * the `data` methods on {@link BonoboUiFrontendClient}. The host answers with a
 * {@link BonoboUiDataUserWriteResultMessage} echoing `requestId`.
 */
export interface BonoboUiDataUserWriteMessage {
	type: "bonobo:data-user-write";
	bridgeNonce: string;
	requestId: string;
	op: "append" | "put" | "remove" | "putOwned" | "removeOwned";
	collection: string;
	keyPrefix?: string;
	key?: string;
	value?: object;
	clientRequestId?: string;
	expectedRevision?: number;
}

/**
 * Sent by the page to `window.parent` to resolve member display names, at most 50 ids per
 * request. The host answers with a {@link BonoboUiDataResolveMembersResultMessage} echoing
 * `requestId`.
 */
export interface BonoboUiDataResolveMembersMessage {
	type: "bonobo:data-resolve-members";
	bridgeNonce: string;
	requestId: string;
	userIds: string[];
}

/**
 * One update for a watch subscription. `docs` replaces the subscription's whole window. `null`
 * means the subscription is dead and the host already dropped it; the SDK delivers the `null`
 * once and drops its registration too. On a death the host may add `reason` (`"invalid"` for
 * inputs it refused locally, `"budget"` for an exhausted start budget) and a static `message`;
 * a bare `null` without a reason means access is gone or the query failed. Window subscriptions
 * additionally carry `hasMore`, `atCapacity`, and `incomplete` on every non-null update.
 */
export interface BonoboUiDataUpdateMessage {
	type: "bonobo:data-update";
	bridgeNonce: string;
	subscriptionId: string;
	docs: BonoboPublicDoc[] | null;
	hasMore?: boolean;
	atCapacity?: boolean;
	incomplete?: boolean;
	reason?: string;
	message?: string;
}

/**
 * Why a subscription died, when the host said so. `reason` is `"invalid"` when the host refused
 * the watch inputs locally, and `"budget"` when the page's start budget ran out (it refills at
 * one start per second). A death without a reason means access is gone or the query failed.
 */
export interface BonoboUiWatchDeathInfo {
	reason?: string;
	message?: string;
}

/**
 * One non-null `data.watchWindow` update. `docs` replaces the whole flattened window, ordered by
 * key. `hasMore` says older docs exist below the window (`loadOlder` fetches them). `atCapacity`
 * says the window cannot grow right now — its interval budget or the frame's subscription budget
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
 * Per-operation bridge write results, exactly the wire shapes the host's five doors answer.
 * Before 0.8.0 one shared type claimed every write resolved `_yay: { key }`; these types are the
 * compile-time correction. `_nay.name` is `"conflict"` for revision, ownership, and key
 * conflicts, and `"storage_full"` when the store is out of capacity; other refusals carry only
 * a message.
 */
export type BonoboUiDataWriteNay = { _nay: { name?: string; message: string } };
export type BonoboUiDataAppendResult = { _yay: { key: string; revision: number; byteSize: number } } | BonoboUiDataWriteNay;
export type BonoboUiDataPutResult = { _yay: { revision: number; byteSize: number } } | BonoboUiDataWriteNay;
export type BonoboUiDataPutOwnedResult =
	| { _yay: { key: string; revision: number; byteSize: number } }
	| BonoboUiDataWriteNay;
export type BonoboUiDataRemoveResult = { _yay: { deleted: boolean } } | BonoboUiDataWriteNay;

/** The result of one bridge write — the union of the per-operation shapes above. */
export type BonoboUiDataWriteResult =
	| BonoboUiDataAppendResult
	| BonoboUiDataPutResult
	| BonoboUiDataPutOwnedResult
	| BonoboUiDataRemoveResult;

/** The host's answer to {@link BonoboUiDataUserWriteMessage} — `result` is handed to the caller as-is. */
export interface BonoboUiDataUserWriteResultMessage {
	type: "bonobo:data-user-write-result";
	bridgeNonce: string;
	requestId: string;
	result: BonoboUiDataWriteResult;
}

/**
 * The host's answer to {@link BonoboUiDataResolveMembersMessage}. A missing or deleted user maps
 * to `null` — how to render that ("former member") is the page's choice.
 */
export interface BonoboUiDataResolveMembersResultMessage {
	type: "bonobo:data-resolve-members-result";
	bridgeNonce: string;
	requestId: string;
	members: Record<string, string | null>;
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
	 * The plugin's own document store over the host bridge. Reads are reactive watches; writes are
	 * performed by the host as the viewing member, so they work without any write scope on the UI
	 * token. Every write resolves with the host's {@link BonoboUiDataWriteResult} as-is — `_nay`
	 * resolves too; a write rejects only when the host does not answer within 10 seconds.
	 */
	data: {
		/**
		 * Opens one reactive subscription on `collection` (optionally narrowed to keys starting
		 * with `keyPrefix`). `onUpdate` receives the subscription's whole current window each time
		 * — replace, do not accumulate — and `null` exactly once when the subscription dies. The
		 * death may carry a {@link BonoboUiWatchDeathInfo} explaining why; a bare `null` means
		 * access is gone. After a `null` the registration is gone. Returns an unsubscribe
		 * function; calling it after a `null` update, or a second time, is a no-op.
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
		 * Creates a document under a host-generated key starting with `keyPrefix`. Pass the same
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
		 * Writes a document only its author may change. The host stores it under the key
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
	/** Member-name resolution over the host bridge. */
	members: {
		/**
		 * Resolves up to 50 user ids to display names. A missing or deleted user maps to `null`.
		 * Rejects only when the host does not answer within 10 seconds.
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
 * Every incoming message requires that origin, `window.parent`, and the fragment nonce;
 * everything else is silently ignored.
 */
export function bonobo_ui_connect(): Promise<BonoboUiFrontendClient>;
