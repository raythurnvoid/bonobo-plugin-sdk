import type { ConvexReactClient } from "convex/react";
import type { GenericId } from "convex/values";
import type { BonoboConvexApi } from "bonobo-plugin-sdk/convex-api";

/**
 * Sent by the frame to `window.parent` at the exact `parentOrigin` from the URL fragment once the
 * connect listener is installed. It tells the host this frame is ready to receive
 * {@link BonoboInitMessage} and proves it read the frame's bootstrap nonce.
 */
export interface BonoboReadyMessage {
	type: "bonobo:ready";
	nonce: string;
}

/**
 * Sent by the frame to `window.parent` to ask for a fresh session token. The host answers with a
 * {@link BonoboTokenMessage} or {@link BonoboTokenErrorMessage} echoing `requestId`.
 */
export interface BonoboTokenRefreshRequestMessage {
	type: "bonobo:token-refresh-request";
	nonce: string;
	requestId: string;
}

/**
 * `context` of {@link BonoboInitMessage} when a plugin page is embedded.
 */
export interface BonoboPageContext {
	/**
	 * Tells the two context shapes apart. A page opens from the sidebar or by URL, not from a file.
	 */
	kind: "page";
	/**
	 * The plugin's name from its manifest. It is the `<pluginName>` part of the page URL.
	 */
	pluginName: string;
	/**
	 * Id of the member viewing this frame. `putOwned`/`removeOwned` stored keys end with it.
	 */
	userId: string;
	/**
	 * The `id` of the `pages[]` entry from the manifest that this frame was opened as. It is the
	 * last part of the page URL. A bundle that serves more than one page uses it to tell which one
	 * it is.
	 */
	pageId: string;
	/**
	 * The `title` of that `pages[]` entry. The host shows it in the breadcrumb and as the iframe's
	 * accessible name. Pages usually copy it into `document.title`.
	 */
	pageTitle: string;
	/**
	 * Id of the organization that owns the workspace. Informational: the session token already
	 * binds every data call to this tenant.
	 */
	organizationId: string;
	/**
	 * Id of the workspace the plugin is installed in. Informational, like `organizationId`.
	 */
	workspaceId: string;
}

/**
 * `context` of {@link BonoboInitMessage} when a plugin file view is embedded — the host opened
 * this frame for one stored file whose content type matched the view's declared list.
 */
export interface BonoboFileViewContext {
	/**
	 * Tells the two context shapes apart. A file view opens as a tab on one stored file in the
	 * Files page.
	 */
	kind: "file_view";
	/**
	 * The plugin's name from its manifest.
	 */
	pluginName: string;
	/**
	 * Id of the member viewing this frame. `putOwned`/`removeOwned` stored keys end with it.
	 */
	userId: string;
	/**
	 * The `id` of the `fileViews[]` entry from the manifest that this frame was opened as. A bundle
	 * that serves more than one view uses it to tell which one it is.
	 */
	fileViewId: string;
	/**
	 * The `title` of that `fileViews[]` entry. The host shows it as the tab label and as the
	 * iframe's accessible name. Views usually combine it with `file.name` for `document.title`.
	 */
	fileViewTitle: string;
	/**
	 * Id of the organization that owns the workspace. Informational: the session token already
	 * binds every data call to this tenant.
	 */
	organizationId: string;
	/**
	 * Id of the workspace the plugin is installed in. Informational, like `organizationId`.
	 */
	workspaceId: string;
	/**
	 * The stored file the view was opened for. `contentType` is the matched stored content type.
	 */
	file: {
		/**
		 * Id of the file node the view was opened for. Pass it to the file routes to read the file.
		 * The host minted the session for this node and re-checks on every refresh that the member
		 * can still read it.
		 */
		fileNodeId: string;
		/**
		 * The file name, for display.
		 */
		name: string;
		/**
		 * The file's full path inside the workspace, for display.
		 */
		path: string;
		/**
		 * The stored content type that matched the view's `contentTypes` list, for example
		 * `video/mp4`.
		 */
		contentType: string;
	};
}

/**
 * `context` of {@link BonoboInitMessage} — discriminated by `kind`.
 */
export type BonoboContext = BonoboPageContext | BonoboFileViewContext;

/**
 * The host's theme, as the plugin frame sees it. `mode` says which of the two the member is in, so
 * a page can pick its own shadows and image treatments. `tokens` holds the app's numbered colour
 * scales under their real custom property names, `--` prefix included: `--color-base-1-01` …
 * `--color-base-1-12`, and the same for `base-2`, `base-alt-1`, `base-alt-2`, `fg`, `accent`,
 * `accent-alt`, `green`, and `red` (`accent` and `accent-alt` have 10 steps, the rest 12). Each
 * value is a finished CSS colour. The SDK writes every entry onto the frame's root element, so a
 * stylesheet can use `var(--color-base-1-03)` exactly as the app does.
 */
export interface BonoboTheme {
	mode: "light" | "dark";
	tokens: Record<string, string>;
}

/**
 * The host's answer to {@link BonoboReadyMessage}: it delivers the short-lived scoped session
 * token (`plu_...`) with its plugin-session JWT, the Convex deployment URL the frame's own client
 * connects to, and the embedding context. The init is trusted only from `window.parent`, the
 * exact `parentOrigin` from the URL fragment, and the matching frame nonce. The token and the JWT
 * travel over postMessage only and are never placed in a URL. `tokenExpiresAt` and
 * `jwtExpiresAt` are Unix epoch milliseconds.
 */
export interface BonoboInitMessage {
	type: "bonobo:init";
	nonce: string;
	apiOrigin: string;
	/**
	 * The Convex deployment URL. The SDK opens its own Convex client against it and
	 * authenticates with the plugin-session JWT delivered beside the session token, so the plugin
	 * doors run without the host window in the path.
	 */
	convexUrl: string;
	token: string;
	tokenExpiresAt: number;
	/**
	 * The plugin-session JWT the frame's own Convex client authenticates with, signed for the same
	 * expiry as the token. A host may send none; the SDK then exchanges the token at
	 * `POST <apiOrigin>/plugins-ui/session-jwt` itself.
	 */
	jwt?: string;
	jwtExpiresAt?: number;
	context: BonoboContext;
	/**
	 * The host theme at startup. A host may send none; then `client.theme.current()` stays `null`,
	 * nothing is written onto the document, and the page keeps its own colours.
	 */
	theme?: BonoboTheme;
}

/**
 * The host's success answer to {@link BonoboTokenRefreshRequestMessage} — a fresh session
 * token with its plugin-session JWT. While the session lives, the refresh rotates the token on
 * that session and extends its life on the server. When the session is already gone (the device
 * slept past its expiry), the token belongs to a new session the host minted for this same frame;
 * the page does nothing different. `tokenExpiresAt` and `jwtExpiresAt` are Unix epoch
 * milliseconds.
 */
export interface BonoboTokenMessage {
	type: "bonobo:token";
	nonce: string;
	requestId: string;
	token: string;
	tokenExpiresAt: number;
	/**
	 * The JWT for the rotated token, signed for the same expiry. A host may send none; the SDK
	 * then exchanges the token itself.
	 */
	jwt?: string;
	jwtExpiresAt?: number;
}

/**
 * The host's unprompted message when the member switches the app's theme. The plugin frame is a
 * separate document, so it never sees the host's own theme class change.
 */
export interface BonoboThemeMessage {
	type: "bonobo:theme";
	nonce: string;
	theme: BonoboTheme;
}

/**
 * The host's failure answer to {@link BonoboTokenRefreshRequestMessage}.
 */
export interface BonoboTokenErrorMessage {
	type: "bonobo:token-error";
	nonce: string;
	requestId: string;
	message: string;
}

/**
 * The connected plugin frontend client resolved by {@link bonobo_connect}, for plugin pages
 * and plugin file views alike. With the `workspace.files.read` capability the UI token carries
 * the `files:list`, `files:read`, and `files:download` scopes for `POST /api/v1/files/list`,
 * `POST /api/v1/files/read`, and `POST /api/v1/files/download-urls`. UI tokens are always
 * rejected on `/api/v1/files/write`.
 */
export interface BonoboClient {
	/**
	 * The {@link BonoboInitMessage} context. Narrow on `context.kind` before using kind-specific fields.
	 */
	context: BonoboContext;
	/**
	 * Origin of the public host API — `fetchJson` prefixes it onto `path`.
	 */
	apiOrigin: string;
	/**
	 * Returns the current session token, refreshing it first when it is expired or within 60
	 * seconds of `tokenExpiresAt`.
	 */
	getToken(): Promise<string>;
	/**
	 * Asks the host for a fresh session token ({@link BonoboTokenRefreshRequestMessage}).
	 * Concurrent callers share one in-flight request. Rejects when the host answers with
	 * {@link BonoboTokenErrorMessage} or does not answer within 10 seconds.
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
	 * The plugin's own backend, run on demand. Needs the `plugin.backend.invoke` capability and a
	 * manifest `backend.endpoints` entry whose `id` matches `endpoint`.
	 */
	backend: {
		/**
		 * Runs the plugin's backend synchronously through the host's
		 * `/api/v1/plugin-backend/invoke` route and resolves with the backend's relayed response.
		 * The call never rejects — every refusal resolves `_nay`
		 * ({@link BonoboBackendInvokeResult}).
		 *
		 * The backend's `fetch` receives `POST https://plugin.local<endpoint.path>` with the
		 * event envelope in the body (`event: "ui.invoke.requested"`); `input` travels inside that
		 * envelope untouched. The raw request body is capped at 32 KiB. Two rules the page and the
		 * backend must follow together:
		 *
		 * - **Identity**: the backend reads who is acting from the envelope's `actorUserId` ONLY.
		 *   `input` is page data — any code running in the frame can fill it with anything, so an
		 *   identity inside it proves nothing.
		 * - **Idempotency**: the store and the file system are two systems, one transaction each,
		 *   so a backend writing both can crash in between and the page may retry. Put a client
		 *   request id inside `input` and make the backend's store writes safe to repeat (for
		 *   example `clientRequestId` on appends); the invoke door itself dedupes nothing.
		 *
		 * At most one invoke run is live per installation (or per `serializationKey` on an
		 * endpoint declared `serialization: "caller-key"`, where the key is required). A concurrent
		 * second invoke resolves `_nay` `busy` with `retryAfterMs`; wait and call again.
		 */
		invoke(opts: { endpoint: string; input?: unknown; serializationKey?: string }): Promise<BonoboBackendInvokeResult>;
	};
	/**
	 * The host's theme. The SDK has already applied it to this document: every token sits on
	 * `document.documentElement.style` under its own name, and the root element carries the same
	 * `light` or `dark` class the app puts on its root. A stylesheet needs nothing from here. Read
	 * `current()` and `subscribe()` only for what CSS cannot do, such as picking a canvas colour or
	 * an image treatment by `mode`; a plugin page never sees the host's theme change on its own.
	 */
	theme: {
		/**
		 * The theme the host last sent, or `null` when the host sent none.
		 */
		current(): BonoboTheme | null;
		/**
		 * Calls `onChange` on every later theme the host sends, after the SDK has applied it to the
		 * document, and never for the current one. Returns the unsubscribe function.
		 */
		subscribe(onChange: (theme: BonoboTheme) => void): () => void;
	};
	/**
	 * The frame's own authenticated Convex client. It is a `ConvexReactClient`, so a page can hand
	 * it to `ConvexProvider` and read the plugin doors with `useQuery`, `useQueries`, and
	 * `usePaginatedQuery` from `convex/react`, or call `watchQuery`, `query`, and `mutation` on it
	 * directly. Always pass a reference from `api`. The SDK owns the client: it opens it on init,
	 * keeps it authenticated, and closes it on `pagehide`. A plugin never builds a second one.
	 *
	 * What the doors answer: a refused read is the door's own answer (`null`, or an empty final
	 * page from `watch_documents_page`), a refused write is its `_nay`, and a transport failure
	 * rejects the promise or throws from the hook. Nothing is retried and nothing is counted: the
	 * server enforces no per-frame subscription cap, so keep the number of live subscriptions
	 * small on purpose. The doors answer the same refusal for a lapsed session and a revoked
	 * plugin; `session.expiresAt()` is what tells them apart.
	 *
	 * The client's authentication is the plugin-session JWT. Only the doors in `api` resolve it to
	 * a member. Every other function of the app sees no user behind it: a query that needs a
	 * member throws `Unauthenticated` (a few, like `users:get_anagraphic`, answer `null` instead)
	 * and a mutation that needs one returns a `_nay` `Unauthenticated`.
	 */
	convex: ConvexReactClient;
	/**
	 * Typed references to the plugin doors, generated from the app into `convex-api.d.ts`
	 * (`bonobo-plugin-sdk/convex-api`). With `convex` above, the arguments and the delivered
	 * value of every call are checked against the app's own types.
	 */
	api: BonoboConvexApi;
	/**
	 * The frame's session, as the SDK tracks it from the host's messages.
	 */
	session: {
		/**
		 * When the current session token expires, in Unix epoch milliseconds: the last
		 * `tokenExpiresAt` the host sent in `bonobo:init` or `bonobo:token`, or the session end the
		 * JWT exchange reported. Compare it with `Date.now()` when a door refuses a read or a write:
		 * a refusal after this time means the session ran out and a reload gets a new one; a refusal
		 * before it means the plugin was uninstalled, disabled, or the member lost access.
		 */
		expiresAt(): number;
		/**
		 * The JWT fetcher the SDK gave the Convex client through `setAuth`. It answers the stored
		 * JWT while it is fresh, refreshes the session through the host when it is not, and resolves
		 * `null` only when the host refuses to mint a session. A page normally never calls it; it is
		 * here so a test or a debugging probe can drive the same auth path the client uses.
		 */
		fetchJwt(args?: { forceRefreshToken: boolean }): Promise<string | null>;
	};
}

/**
 * The id of a member as the plugin doors type it: a `users` table id, a branded string. Every id
 * the SDK hands out (`context.userId`, a member's `userId`, a principal's `userId`) is a plain
 * string, so cast it with `as BonoboUserId` before passing it to a door through `convex`. A plugin
 * has no `convex` package of its own to import the id type from, which is why it is exported here.
 */
export type BonoboUserId = GenericId<"users">;

/**
 * The result of one backend invoke. Like a data write it resolves rather than rejects.
 *
 * `_yay` relays the backend's own response: `pluginStatus` is the HTTP status the plugin's `fetch`
 * answered, `output` its response body text (`outputTruncated` when the host cut it at its byte
 * cap), and `runId` names the run record for support and debugging. A `pluginStatus` outside 2xx
 * still resolves `_yay` — the backend answered; what its answer means is the plugin's own
 * contract.
 *
 * `_nay.name` is `"busy"` for the serialization lock and the invoke rate bucket alike (both carry
 * `retryAfterMs`; wait and call again), `"denied"` when the workspace has not accepted
 * `plugin.backend.invoke` or the plugin may not act here any more, `"session_expired"` when this
 * frame's session lapsed, `"invalid"` for a refused request (an unknown endpoint, a missing
 * `serializationKey`, an over-large body), and `"unavailable"` when the backend failed or the
 * outcome is unknown — the run may or may not have happened, which is why store writes must be
 * safe to repeat.
 */
export type BonoboBackendInvokeResult =
	| { _yay: { runId: string; pluginStatus: number; output: string; outputTruncated: boolean } }
	| { _nay: { name: string; message: string; retryAfterMs?: number } };

/**
 * Connects the frame to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts {@link BonoboReadyMessage} to `window.parent`, and resolves
 * with the client when the host's {@link BonoboInitMessage} arrives.
 * `bonobo:init` messages after the first are ignored.
 *
 * The URL fragment must contain one canonical HTTP(S) `parentOrigin` and one UUIDv4
 * `nonce`. Fragments are not sent in the asset request, cache key, or referrer. Ready
 * messages carry the nonce, target only that parent origin, and retry until the host answers or
 * the document unloads. The host owns the startup deadline and replaces a failed frame; the SDK
 * does not run a competing timeout.
 *
 * On init the SDK opens the frame's own Convex client against the init's `convexUrl` and closes
 * it on `pagehide` — a frame restored from the browser's back/forward cache stays frozen and
 * needs a reload. The client authenticates with the plugin-session JWT the host delivers beside
 * the session token; it expires with the token, and a host refresh answers with both. The Convex
 * client asks for a new JWT shortly before it expires, and that ask is what triggers the host
 * refresh, which extends the session. A host that sends no JWT is covered by exchanging the token
 * at the same-origin `/plugins-ui/session-jwt` route; that exchange never extends the session. A
 * one-second wake poll treats a wall-clock gap of 30 seconds as sleep and calls `setAuth` again,
 * so Convex pauses before the old session's query set can reconnect while the host re-mints it.
 *
 * Every incoming message requires that origin, `window.parent`, and the fragment nonce;
 * everything else is silently ignored.
 */
export function bonobo_connect(): Promise<BonoboClient>;
