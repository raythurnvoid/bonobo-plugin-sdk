import type { BonoboPublicDoc } from "bonobo-plugin-sdk";

/**
 * Sent by the frame to `window.parent` at the exact `parentOrigin` from the URL fragment once the
 * connect listener is installed. It tells the host this frame is ready to receive
 * {@link BonoboUiInitMessage} and proves it read the frame's bootstrap nonce.
 */
export interface BonoboUiReadyMessage {
	type: "bonobo:ready";
	bridgeNonce: string;
}

/**
 * Sent by the frame to `window.parent` to ask for a fresh session token. The host answers with a
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
 * One colour role in the host's theme. The host resolves its own palette and sends the finished
 * values, so a plugin gets colours that match the app without knowing anything about the host's
 * custom properties.
 */
export type BonoboUiThemeToken =
	| "surface"
	| "surfaceRaised"
	| "surfaceOverlay"
	| "surfaceHover"
	| "border"
	| "borderStrong"
	| "text"
	| "textMuted"
	| "textSubtle"
	| "accent"
	| "accentHover"
	| "selection"
	| "success"
	| "danger";

/**
 * The host's theme, as the plugin frame sees it. `mode` says which of the two the member is in, so
 * a page can pick its own shadows and image treatments. `tokens` holds one CSS colour value per
 * role, ready to write into a custom property or a style.
 */
export interface BonoboUiTheme {
	mode: "light" | "dark";
	tokens: Record<BonoboUiThemeToken, string>;
}

/**
 * The host's answer to {@link BonoboUiReadyMessage}: it delivers the short-lived scoped session
 * token (`plu_...`), the Convex deployment URL the frame's own client connects to, and the
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
	/**
	 * The host theme at startup. It is optional because an older host sends none, and then
	 * `client.theme.current()` stays `null` and the page falls back to its own colours.
	 */
	theme?: BonoboUiTheme;
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

/**
 * The host's unprompted message when the member switches the app's theme. The plugin frame is a
 * separate document, so it never sees the host's own theme class change.
 */
export interface BonoboUiThemeMessage {
	type: "bonobo:theme";
	bridgeNonce: string;
	theme: BonoboUiTheme;
}

/** The host's failure answer to {@link BonoboUiTokenRefreshRequestMessage}. */
export interface BonoboUiTokenErrorMessage {
	type: "bonobo:token-error";
	bridgeNonce: string;
	requestId: string;
	message: string;
}

/**
 * Why a subscription died. A page shows a different thing for each, so the SDK names all five:
 *
 * - `"invalid"` — the watch inputs failed the client-side checks. This is a bug in the call.
 * - `"capacity"` — the frame already holds too many live subscriptions. Close one first.
 * - `"denied"` — the store refused the read. The plugin was uninstalled, or its data was removed.
 * - `"session_expired"` — the frame's session ran out. Reloading the page gets a new one.
 * - `"unavailable"` — the data connection failed. Nothing the member does fixes this one.
 *
 * `info` is absent only when the SDK could not start the subscription at all, and then the failure
 * is already visible at the call site.
 */
export interface BonoboUiWatchDeathInfo {
	reason?: string;
	message?: string;
}

/**
 * One non-null `data.watch`, `data.watchRecent`, or `data.watchChanges` update. `docs` replaces
 * the whole list — ordered by key for `watch`, by creation time for `watchRecent`, by update
 * time for `watchChanges`. `truncated`
 * says the read hit its own `limit` and the documents past that limit are not in `docs`. A plain
 * watch cannot reach them at all — it re-reads one capped page and keeps no history — so a page
 * that must show everything has to use `watchWindow` instead. Without this flag a page cannot tell
 * "this is the whole collection" from "this is the first `limit` of it", and the documents past
 * the cap disappear with no sign.
 */
export interface BonoboUiDataWatchUpdate {
	docs: BonoboPublicDoc[];
	truncated: boolean;
}

/**
 * One non-null `data.watchWindow` update. `docs` replaces the whole flattened window, ordered by
 * key. `hasMore` says older docs exist below the window (`loadOlder` fetches them). `atCapacity`
 * says the window cannot grow right now — either its own 6-interval budget or the frame's
 * 100-subscription backstop is spent. `incomplete` says docs are missing in the middle of the
 * window because an overflowing range could not be re-read; treat the list as gapped, not merely
 * short. Re-reading a range splits it in two, so it needs a free interval AND two free frame
 * subscriptions. `incomplete` stays false while a repair is running, and stays true once the range
 * is stuck — the window does not get those docs back on its own.
 */
export interface BonoboUiDataWindowUpdate {
	docs: BonoboPublicDoc[];
	hasMore: boolean;
	atCapacity: boolean;
	incomplete: boolean;
}

/**
 * Per-operation write results, exactly the shapes the store's five write doors answer.
 * `_nay.name` is `"conflict"` for revision, ownership, and key conflicts, `"storage_full"`
 * when the store is out of capacity, and `"unavailable"` when the write call itself fails.
 * Other backend refusals carry only a message.
 */
export type BonoboUiDataWriteNay = { _nay: { name?: string; message: string } };
export type BonoboUiDataAppendResult =
	| { _yay: { key: string; revision: number; byteSize: number } }
	| BonoboUiDataWriteNay;
export type BonoboUiDataPutResult = { _yay: { revision: number; byteSize: number } } | BonoboUiDataWriteNay;
export type BonoboUiDataPutOwnedResult =
	| { _yay: { key: string; revision: number; byteSize: number } }
	| BonoboUiDataWriteNay;
export type BonoboUiDataRemoveResult = { _yay: { deleted: boolean } } | BonoboUiDataWriteNay;

/**
 * One row of the workspace roster. `displayName` is `null` for a member who has no profile name
 * yet, which includes a member who signed in anonymously. Email is never part of a row.
 */
export interface BonoboUiMember {
	userId: string;
	displayName: string | null;
}

/**
 * One `members.list` answer.
 *
 * A refusal resolves `_nay` and never an empty roster, because `{ members: [] }` would tell the
 * member this workspace has nobody in it. `_nay.name` uses the same words as a watch death
 * ({@link BonoboUiWatchDeathInfo}), plus one this call has of its own:
 *
 * - `"not_consented"` — this workspace never accepted `workspace.members.read`. An admin accepting
 *   the plugin's current permissions fixes it, so say that instead of showing an empty list.
 * - `"invalid"` — `limit` failed the client-side check. This is a bug in the call.
 * - `"denied"` — the frame's access is gone: the plugin was uninstalled or the member left.
 * - `"session_expired"` — the frame's session ran out. Reloading the page gets a new one.
 * - `"unavailable"` — the data connection failed. Nothing the member does fixes this one.
 */
export type BonoboUiMemberListResult =
	| { _yay: { members: BonoboUiMember[]; cursor: string | null } }
	| { _nay: { name: string; message: string } };

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
	 * The result is `unknown` on purpose. It is whatever the API answered, so the page has to
	 * check the shape before reading it. The pagination note below is the reason: a listing page
	 * may come back short or even empty, and a type that let you read `.items` straight away
	 * would hide that.
	 *
	 * Pagination: with `contentTypePrefixes`, one `/api/v1/files/list` request uses one bounded
	 * query. `scanLimit` sets its source-doc budget; the server defaults and caps it at 10,000 docs.
	 * The query does not set a byte-read cap. A page may come back short or even empty while
	 * `isDone` is still `false`.
	 * Scan with `limit: 100`, `scanLimit: 10000`, and `kind: "file"`. Advance a bounded number
	 * of requests per user action (say 30), keep `cursor` across actions, buffer items fetched
	 * beyond what is shown, and retry a `429` on the same cursor — the page is not lost.
	 */
	fetchJson(
		path: string,
		init?: { method?: string; headers?: Record<string, string>; body?: unknown },
	): Promise<unknown>;
	/**
	 * The plugin's own document store, on the frame's own Convex client. Reads are reactive
	 * Convex subscriptions; writes run as the viewing member, attributed to the session's user.
	 * Every write RESOLVES with a {@link BonoboUiDataWriteResult} — `_nay` resolves too, and a
	 * failed call (network loss, an unserializable payload) resolves the stable
	 * `{ _nay: { name: "unavailable", message: "Failed to write plugin data" } }` instead of rejecting.
	 */
	data: {
		/**
		 * Opens one reactive subscription on `collection` (optionally narrowed to keys starting
		 * with `keyPrefix`). `onUpdate` receives a {@link BonoboUiDataWatchUpdate} holding the
		 * subscription's whole current window each time — replace, do not accumulate — and `null`
		 * exactly once when the subscription dies. Read `truncated` on every update: the read is
		 * capped at `limit`, and everything past the cap is simply not there. The
		 * death may carry a {@link BonoboUiWatchDeathInfo} explaining why; a bare `null` means
		 * access is gone. After a `null` the registration is gone. Returns an unsubscribe
		 * function; calling it after a `null` update, or a second time, is a no-op.
		 *
		 * `limit` must be an integer from 1 to 100 — an out-of-range limit kills the
		 * subscription at birth with `reason: "invalid"`, nothing is clamped. The SDK allows at
		 * most 16 active subscriptions per frame (plain watches and windows share those slots);
		 * one more dies at birth with `reason: "capacity"`.
		 *
		 * A second ceiling is a backstop for a buggy or hostile page, not a budget honest plugins
		 * design against. The frame holds at most 100 server subscriptions: one per plain watch,
		 * one per window interval. Slots and intervals are what shape a page — 16 fully-grown
		 * windows spend 96, which stays under 100. A watch opened after that backstop is spent
		 * dies with `reason: "capacity"` too. Close a window or a watch to get subscriptions back.
		 */
		watch(
			opts: { collection: string; keyPrefix?: string; limit: number },
			onUpdate: (update: BonoboUiDataWatchUpdate | null, info?: BonoboUiWatchDeathInfo) => void,
		): () => void;
		/**
		 * Opens one reactive subscription on the NEWEST documents of `collection`, ordered by
		 * creation time — which key order cannot answer for keys that carry no timestamp. Pass
		 * `scopeId` to read one private scope instead of the public half; there is no key range
		 * here to resolve a scope from. Edits and deletions never move a document in this order:
		 * a tombstoned doc keeps its creation-time slot, so read its value's own deletion marker.
		 * The delivery contract is `watch`'s: each update replaces the whole list, `null` ends the
		 * subscription, `limit` follows the same 1..100 rule, and the read spends the same frame
		 * slot and server subscription.
		 *
		 * `order` defaults to `"asc"`. Each fencepost belongs to one direction: `since` (exclusive
		 * lower bound, ms — the catch-up read) only with ascending, and `before` (exclusive upper
		 * bound, ms — the feed read) only with descending. Copy either fencepost from a delivered
		 * doc's `createdAt`. The server judges the pairing, and a violation kills the subscription
		 * with a bare `null`, like any other refused read.
		 */
		watchRecent(
			opts: {
				collection: string;
				limit: number;
				order?: "asc" | "desc";
				since?: number;
				before?: number;
				scopeId?: string;
			},
			onUpdate: (update: BonoboUiDataWatchUpdate | null, info?: BonoboUiWatchDeathInfo) => void,
		): () => void;
		/**
		 * Opens one reactive subscription on documents of `collection` that changed at or after
		 * `updatedSince`, ordered by update time. Pass `scopeId` to read one private scope instead
		 * of the public half; there is no key range here to resolve a scope from. An edit and a
		 * soft-delete both bump `updatedAt` and surface here — that is the point, and it is why
		 * this is not `watchRecent`. A physically deleted document is gone from the table and
		 * cannot appear.
		 *
		 * `updatedSince` is an inclusive lower bound. Copy it from the newest `updatedAt` you have
		 * already applied; omit it to start from the oldest update. `updatedAt` is whole-millisecond
		 * `Date.now()`, and one write batch stamps every document with the same value, so a change
		 * whose `updatedAt` equals the cursor must still be delivered. Over-delivery of that
		 * millisecond is free: merge by key and revision. Advance the cursor only when a later
		 * `updatedAt` arrives, or the same-millisecond re-delivery will re-subscribe in a loop.
		 * If a delivery is truncated and every document is still on the cursor millisecond, pass
		 * `newest + 1` so the live query can leave those 100 rows. That step can permanently skip tied rows past the first 100
		 * when 101 or more documents in one collection and scope share the same `Date.now()` millisecond, reachable only
		 * through parallel bulk imports on the batch door (three 50-document mutations in one millisecond); replies and
		 * reactions have no heal for it, and messages heal one page.
		 *
		 * The delivery contract is `watch`'s: each update replaces the whole list, `null` ends the
		 * subscription, `limit` follows the same 1..100 rule, and the read spends the same frame
		 * slot and server subscription.
		 */
		watchChanges(
			opts: {
				collection: string;
				limit: number;
				updatedSince?: number;
				scopeId?: string;
			},
			onUpdate: (update: BonoboUiDataWatchUpdate | null, info?: BonoboUiWatchDeathInfo) => void,
		): () => void;
		/**
		 * Opens one reactive document WINDOW on `collection` (optionally narrowed to `keyPrefix`).
		 * Unlike `watch`, a window RETAINS loaded history: new arrivals grow it instead of pushing
		 * older docs out, and `loadOlder()` extends it one `pageSize` further into older keys while
		 * `hasMore` is true. `onUpdate` receives the whole flattened window each time
		 * ({@link BonoboUiDataWindowUpdate}), and `null` exactly once when the window dies — same
		 * death contract as `watch`. A window can hold up to 6 internal reads (600 docs at
		 * `pageSize` 100); past that it reports `atCapacity` instead of growing.
		 *
		 * The frame's 100 server subscriptions are a backstop for buggy or hostile pages, not a
		 * budget honest plugins design against. Every internal read of every window spends one.
		 * Slots and intervals are what shape a page (16 × 6 = 96). A window reports `atCapacity`
		 * and refuses `loadOlder()` when its own 6 reads are used, or if that backstop is gone.
		 * The same backstop kills a new window at birth with `reason: "capacity"`.
		 *
		 * That budget has a third effect, and it is the one that loses docs. When new docs overflow
		 * a range the window already holds, the window re-reads that range as two smaller ones, so
		 * the repair needs a free interval and TWO free frame subscriptions. When it cannot start,
		 * the docs pushed out of that range are gone from the window for good and `incomplete`
		 * turns true. Close another window or watch to leave room for repairs.
		 */
		watchWindow(
			opts: { collection: string; keyPrefix?: string; pageSize: number },
			onUpdate: (update: BonoboUiDataWindowUpdate | null, info?: BonoboUiWatchDeathInfo) => void,
		): { unsubscribe: () => void; loadOlder: () => void };
		/**
		 * Creates a document under a server-generated key starting with `keyPrefix`. Pass the same
		 * `clientRequestId` when retrying so a replayed append answers the stored key instead of
		 * writing twice. The new document is member-owned (`ownership: "owned"`): only the appending
		 * member may later change or delete it through interactive writers.
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
		 * against this member's own document at the composed key. With `expectedRevision: 0`,
		 * a normal shared document squatting that composed key is replaced by a fresh owned document;
		 * a versioned producer document or another member's owned document still refuses.
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
	/**
	 * The host's theme. Read `current()` once at startup and `subscribe()` for later switches; a
	 * plugin page never sees the host's theme change on its own.
	 */
	theme: {
		/** The theme the host last sent, or `null` when the host sent none. */
		current(): BonoboUiTheme | null;
		/**
		 * Calls `onChange` on every later theme the host sends, and never for the current one.
		 * Returns the unsubscribe function.
		 */
		subscribe(onChange: (theme: BonoboUiTheme) => void): () => void;
	};
	/** Member names and the workspace roster, on the frame's own Convex client. */
	members: {
		/**
		 * Resolves up to 50 user ids to display names. A missing or deleted user maps to `null`.
		 * A denied or failed query resolves an empty map; the call never rejects.
		 */
		resolve(userIds: string[]): Promise<Record<string, string | null>>;
		/**
		 * Reads one page of the workspace roster. Needs the `workspace.members.read` capability,
		 * which `resolve` above does not: resolving names for ids the plugin already holds
		 * enumerates nobody, and this reads the list itself.
		 *
		 * The order is stable but carries no meaning — it follows the internal user id. Sort the
		 * rows yourself before showing them.
		 *
		 * `limit` must be an integer from 1 to 100. Pass the previous answer's `cursor` to read the
		 * next page; a `null` cursor means that was the last page. The call never rejects — every
		 * refusal resolves `_nay` ({@link BonoboUiMemberListResult}), and no refusal ever looks like
		 * an empty workspace.
		 */
		list(opts: { limit: number; cursor?: string | null }): Promise<BonoboUiMemberListResult>;
	};
	/**
	 * Private key ranges inside the plugin's own store — a private channel, a direct message, or
	 * anything else only some members may read.
	 *
	 * A scope covers one key prefix across the collections it names. Every document written under
	 * that prefix carries the scope, and every read door hides it from a member the scope does not
	 * name. That hiding is total and needs no help from the page: an unreadable scope's documents
	 * never arrive, so a channel list built from a watch shows nothing at all for it. Do not render
	 * a locked placeholder from some other source — a placeholder tells the member the channel
	 * exists, which is the one thing the scope is for.
	 *
	 * Three things the page must say or handle. The organization owner passes every permission check
	 * before any grant is read, so the owner reads every scope; copy that says "private" without
	 * saying that is a disclosure. A member may hold at most 50 scopes, so a page that creates them
	 * has to let members leave one too. One installation may create at most 1,000 scope ids over its
	 * lifetime; uninstalling and reinstalling resets that cap.
	 */
	scopes: {
		/**
		 * Creates a scope, or answers yes again for one the caller can still read that already exists
		 * with the same range. The caller receives the first `manage` grant on a new scope.
		 *
		 * Name every collection the private area spans in one call. That costs one scope against the
		 * member's cap, and it is the only way to create it over all of them at once: a scope built
		 * one collection at a time leaves the rest readable in between.
		 *
		 * The key range must be free — no other scope may overlap it, and no document may already
		 * sit in it. Write the documents after this call answers, never before. A scope id and its
		 * range can never be reused during this installation's lifetime, even when the scope was empty.
		 * Create number 1,001 is refused with `storage_full`.
		 */
		create(opts: { scopeId: string; collections: string[]; keyPrefix: string }): Promise<BonoboUiScopeResult>;
		/**
		 * Creates a scope, its full first principal list, and one shared document in one transaction.
		 * Use this when the document is what makes the private area visible. Every check runs before
		 * any row is written, and the whole setup uses one page-write rate-limit charge.
		 *
		 * The creator is added with `manage` automatically. Do not include them in `principals`.
		 * The document's collection must be named by the scope and its key must start with `keyPrefix`.
		 */
		createWithDocument(opts: {
			scopeId: string;
			collections: string[];
			keyPrefix: string;
			principals: { userId: string; level: "member" | "manage" }[];
			document: { collection: string; key: string; value: Record<string, unknown> };
		}): Promise<BonoboUiScopeResult>;
		/**
		 * Adds somebody to the scope, or changes the level they already hold. `member` reads and
		 * writes inside it; `manage` also changes who else is in it. Needs `manage` on this scope —
		 * a workspace role, however senior, gives nothing here. The host refuses without writing when
		 * adding the person would put them over their private-scope cap. A manager cannot change their
		 * own level to `member`; use `removePrincipal` to leave.
		 */
		setPrincipal(opts: { scopeId: string; userId: string; level: "member" | "manage" }): Promise<BonoboUiScopeResult>;
		/**
		 * Takes somebody out of the scope. Taking somebody else out needs `manage`. Taking yourself
		 * out is always allowed when you are in the scope. If you are the last active person in the scope,
		 * leaving deletes the scope and its grants; the documents stay until the plugin is uninstalled.
		 * If the last manager leaves a shared scope, the host promotes the remaining active person with the
		 * lowest stable user id to `manage`.
		 * The result's `deleted` flag says which happened. Its `membershipRevision` is the scope
		 * membership change this call made. Compare it with `watchMine` when another manager may add
		 * the member back before the Leave reply arrives. Pass `expectedPrincipalCount` when copy
		 * promised one outcome; if the count changed, the host refuses without writing so the person
		 * can confirm again.
		 */
		removePrincipal(opts: {
			scopeId: string;
			userId: string;
			expectedPrincipalCount?: number;
		}): Promise<BonoboUiScopeResult>;
		/**
		 * Deletes the scope and every grant on it. Needs `manage`.
		 *
		 * The documents stay where they are. The scope id and key range stay reserved until the
		 * plugin is uninstalled, even when the scope stored no document. This keeps a stale frame from
		 * writing private data as public after deletion.
		 */
		delete(opts: { scopeId: string; expectedPrincipalCount?: number }): Promise<BonoboUiScopeResult>;
		/**
		 * Which active workspace members are in the scope. Retained grants for inactive or deleted
		 * members are omitted, so this list's count matches leave and delete confirmation checks.
		 * An organization owner receives the full principal list without a scope grant. For any other
		 * caller the `_yay` value is `null` when the scope does not name them, which is also the answer
		 * for a scope that does not exist — so a refusal reveals nothing. Compare the returned user ids
		 * with the caller's own user id; a non-null list alone does not prove scope membership.
		 *
		 * Use it to show and edit a share list. Without it a page can add people to a private
		 * channel and can never show or change the list again.
		 *
		 * An exact query answer resolves `{ _yay: principals }`, including `{ _yay: null }` for
		 * the unreadable or absent case above. A transport failure or malformed response resolves
		 * `{ _nay: { name: "unavailable", message: "Failed to read who can access this" } }`.
		 */
		listPrincipals(opts: { scopeId: string }): Promise<BonoboUiScopePrincipalListResult>;
		/**
		 * Watches which scopes this member is in. This is how a page finds its private documents
		 * again: a read with no `keyPrefix` answers only the public part of a collection, and the
		 * scope id is yours, so nothing else on the server can hand it back. Read this first, then
		 * open one `watch` per scope with `keyPrefix` set to the scope's `keyPrefix`.
		 *
		 * It is live on purpose. When somebody adds this member to a scope the list updates by
		 * itself, so a private channel appears without a reload — and disappears the same way when
		 * they are taken out.
		 *
		 * The organization owner may read every scope but sees only the ones they were added to. A
		 * private range nobody invited them to is not listed here.
		 *
		 * `onUpdate` receives the whole current list each time — replace, do not accumulate — and
		 * `null` exactly once when the subscription dies, with the same death contract as
		 * `data.watch`. It holds one of the frame's subscription slots. Returns an unsubscribe
		 * function; calling it after a `null` update, or a second time, is a no-op.
		 */
		watchMine(onUpdate: (scopes: BonoboUiScope[] | null, info?: BonoboUiWatchDeathInfo) => void): () => void;
	};
}

/** One member of a scope. `manage` may change who else is in it; `member` may not. */
export interface BonoboUiScopePrincipal {
	userId: string;
	level: "member" | "manage";
}

/**
 * The result of reading a scope's active principals. `_yay: null` is an exact unreadable or absent
 * answer. `_nay` means the query outcome is unavailable and may be retried.
 */
export type BonoboUiScopePrincipalListResult =
	| { _yay: BonoboUiScopePrincipal[] | null }
	| { _nay: { name: "unavailable"; message: string } };

/** One scope this member is in, as {@link BonoboUiFrontendClient.scopes.watchMine} reports it. */
export interface BonoboUiScope {
	scopeId: string;
	/** Every key under this prefix belongs to the scope, in each of its `collections`. */
	keyPrefix: string;
	collections: string[];
	/**
	 * Durable last successful append in each private collection that has one, sorted by collection.
	 * `sequence` increases for each new accepted append in that collection. The document and activity
	 * commit together. This does not change `membershipRevision`.
	 */
	appendActivity: Array<{ collection: string; at: number; createdByUserId: string; sequence: number }>;
	level: "member" | "manage";
	/** Increases on every successful change to this scope's members or their levels. */
	membershipRevision: number;
}

/**
 * The result of one scope change. Like a data write it resolves rather than rejects. A transport
 * or runtime failure resolves `{ _nay: { name: "unavailable", message: "Failed to change who can
 * read this" } }` instead of throwing. Ordinary backend results pass through unchanged.
 *
 * `_nay.name` is `"conflict"` when the scope id is unavailable, when another scope overlaps the
 * range, when the range already holds documents, or when a confirmed principal count changed.
 * Lifecycle calls give the same opaque refusal for an unreadable live scope and an absent or
 * released one. Unreadable live and released range overlaps also share one opaque answer.
 * Creating scope id 1,001 for one installation uses `"storage_full"`. Other refusals carry a
 * message only.
 */
export type BonoboUiScopeResult =
	| {
			_yay: { scopeId: string; deleted: boolean; membershipRevision: number };
	  }
	| BonoboUiDataWriteNay;

/**
 * Connects the frame to the embedding host app. It installs one shared `message` listener (for
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
 * On init the SDK opens the frame's own Convex client against the init's `convexUrl` and closes
 * it on `pagehide` — a frame restored from the browser's back/forward cache stays frozen and
 * needs a reload. The client authenticates with short-lived plugin-session JWTs minted by
 * exchanging the session token at the same-origin `/plugins-ui/session-jwt` route. The exchange
 * itself never extends the session; it stays alive because the SDK refreshes the session token
 * through the host, and that host refresh extends it.
 *
 * Every incoming message requires that origin, `window.parent`, and the fragment nonce;
 * everything else is silently ignored.
 */
export function bonobo_ui_connect(): Promise<BonoboUiFrontendClient>;
