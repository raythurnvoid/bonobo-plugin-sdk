# Bonobo Plugin SDK

SDK for Bonobo workspace plugins. The root export is types-only (a single hand-written `index.d.ts` built on `@cloudflare/workers-types`) — plugin workers are plain Cloudflare-style JS typed via JSDoc. The `bonobo-plugin-sdk/frontend` export adds a small hand-written browser ESM runtime for plugin UI pages and file views (see [Frontend pages](#frontend-pages)).

## Capabilities

A plugin manifest declares capabilities (`BonoboCapability`), which a workspace consents to on install. A capability may authorize more than one caller, so each entry below names every caller it reaches.

Backend run (`fetch(request, env, ctx)`):

- `plugin.secrets.read` — `env.BONOBO.secrets.get(name)` resolves the publisher secret (or the workspace's shadowing installation secret) or `null`.
- `outbound.fetch` — native `fetch` to third-party HTTPS origins listed in the manifest's `outboundOrigins`.
- `plugin.data.read` — read the plugin's own document store.
- `plugin.data.write` — create, change, and delete documents in that store. Declaring it also requires `plugin.data.read`.

Plugin page and file view (the sandboxed iframe):

- `workspace.files.read` — read access to workspace files: the frame's UI token carries the `files:list`, `files:read`, and `files:download` scopes. It never applies to backend runs.
- `plugin.data.read` — read the plugin's own document store; the UI token carries `plugin_data:read`.
- `ui.outbound.fetch` — the page may call the manifest's `uiOutboundOrigins`. It is enforced as `connect-src` in the page's CSP, so it is the browser that refuses anything else. This capability and `uiOutboundOrigins` require each other: neither may be declared alone. Keep it separate from `outbound.fetch` — that one is the backend, this one is a page holding a member's session token.

Service grant (Council only today):

The current host exchange is bound to Council. Other plugins cannot obtain a service grant yet.

- `plugin.service.connect` — lets a Council page UI token participate in the exchange, but grants no API scope itself. The Council service must also authenticate with its configured service secret. Declaring it requires `plugin.data.read` or `workspace.files.write`, because a grant carrying no scope buys the service nothing.
- `plugin.data.read` — an eligible Council grant may read the plugin's own document store.
- `plugin.data.write` — an eligible Council grant may write the plugin's document store. A page token never receives this scope, whatever the installation accepted: a page session can belong to an anonymous identity and is the surface an XSS reaches first, so a write from there would become injected input the backend later acts on with its secrets.
- `workspace.files.write` — authorizes `files:write` on a sealed processing-phase service grant, capped by an exact destination path prefix. The interactive exchange still never mints this scope; the service gets it by sealing (below). Only the `/api/v1/files/service-uploads/*` routes accept it — the generic `/api/v1/files/*` routes still refuse service grants.

### Grant lifecycle and service upload routes (Council service only)

An interactive grant comes from `POST /api/internal/plugins/service-grants/exchange` (page token + service secret) and carries `plugin_data:read` and `plugin_data:write` for one working day, renewable. When a meeting closes, the service seals it:

- `POST /api/internal/plugins/service-grants/seal-processing` — service secret + live interactive `psg_` bearer, body `{ destinationPathPrefix }` (a normalized absolute path of canonical lowercase folder names, not `/`). Mints a NEW processing-phase grant for the same installation and member with scopes `["plugin_data:read", "plugin_data:write", "files:write"]`, bound to exactly that prefix, expiring six days from the seal. Renewal rotates a processing token but never moves that deadline. A processing grant cannot seal again, so the window cannot roll forever. Requires all four Council capabilities and refuses if any is missing rather than minting a narrower grant.

The sealed grant then drives the upload pipeline — plain `Authorization: Bearer <psg_...>` calls (no service secret header), all POST, all requiring the `files:write` scope and the `processing` phase:

| Route                                       | Body                                                        | Response                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/files/service-uploads/reserve`     | `{ idempotencyKey, reservedBytes, expiresAt }`              | `{ reservationId, remainingBytes, expiresAt }`                                                                                                    |
| `/api/v1/files/service-uploads/create-target` | `{ idempotencyKey, targetKey, path, contentType, size }`  | pending: `{ state: "pending", path, nodeId, uploadUrl, headers, uploadUrlExpiresAt }`; replay after confirm: `{ state: "committed", path, nodeId, actualBytes }` |
| `/api/v1/files/service-uploads/remint`      | `{ idempotencyKey, targetKey }`                             | same union as create-target: a fresh URL for the same staging key, or `committed` once the object is confirmed                                     |
| `/api/v1/files/service-uploads/finalize`    | `{ idempotencyKey, targetKey }`                             | `{ state: "pending" \| "committed" \| "released", path, nodeId, actualBytes \| null }`                                                             |
| `/api/v1/files/service-uploads/release`     | `{ idempotencyKey }`                                        | `{ releasedBytes }`                                                                                                                               |
| `/api/v1/files/service-uploads/delete`      | `{ idempotencyKey, targetKey }`                             | `{ state: "deleting" \| "deleted", paths }`                                                                                                       |
| `/api/v1/files/service-uploads/archive-destination` | `{}`                                                | `{ archivedNodes }`                                                                                                                               |

Contract highlights:

- `idempotencyKey` names the meeting's whole reservation; `targetKey` names one file in it. Replays with the same body answer the same thing; the same key with a different body answers `409`.
- Reserve the meeting's whole byte envelope up front (at most 532 MiB per reservation) against the workspace's 10 GiB `plugin_service_storage_bytes` quota. Every target's `size` spends from the envelope, never from the quota directly.
- Every `path` must live strictly under the sealed `destinationPathPrefix`; anything else answers `403 Path is outside this grant's destination`. Paths use the app's canonical form: lowercase folder segments, real upload file names.
- Upload with a signed PUT to `uploadUrl` (send exactly the returned `headers`), then poll `finalize` until `state` is `"committed"`. `remint` when the 15-minute URL expired mid-retry. `finalize` answering `"released"` means the upload window is gone for good — retry under a new `targetKey`.
- `release` when the meeting's uploads are done (or abandoned): it refunds the unspent envelope and deletes pending placeholders, while committed files stay stored and charged. An hourly host cron releases expired reservations on its own, so a crashed service does not hold the quota forever.
- `delete` removes the committed files a `targetKey` stored, for a service that must really remove one stored file and get the bytes back. The Council delete does not use it — it archives its whole folder with `archive-destination` below. It works days later under a NEW grant sealed to the same destination — the original reservation may be long gone — and it only sees targets whose stored path is inside the presenting grant's prefix. It answers `"deleting"` immediately (file gone from the workspace, R2 deletion enqueued) and `"deleted"` once R2 confirmed the object is gone; the quota refund happens at that confirmation, not at the request. Replays keep answering; a still-pending target answers `409` (release owns those); an unknown key answers `404`.
- `archive-destination` archives the whole destination folder, with every file still inside it, for the delete-meeting workflow. The body is empty on purpose: the seal names the folder, so the grant can never reach another one. Archiving is what "delete a file" means to a member — the folder leaves the file tree in one archive operation, so a member can restore the exact set. Stored bytes stay charged, because only `delete` removes the R2 object. A destination that was never created, or one a member already archived, answers `{ archivedNodes: 0 }`, so a replayed delete is happy. Inside the fence it obeys the same rules a member gets: a restricted folder answers `403 Permission denied`, a locked or read-only item answers `409`, and either way nothing is archived.
- The seal validates the destination as-is and refuses non-canonical folder names with `400`. Normalize your configured folder before sealing (for example `/Meetings` → `/meetings`); the host never normalizes it for you.
- Error statuses: `400` invalid input, `401` dead grant/installation/membership, `403` missing scope, wrong phase, destination fence, or a full quota, `404` unknown reservation or target (including another workspace's), `409` idempotency conflicts and replay-after-release.

The host APIs below need no capability: requests to `env.BONOBO.host.apiOrigin` are always allowed.

## Installation configuration

A plugin may declare a YAML editor and attach generic filters to its events. The YAML shape belongs to the plugin. The host only parses it as a JSON-like object and validates values referenced by declared filters.

```jsonc
"configuration": {
	"description": "Choose which upload folders start this plugin.",
	"defaultYaml": "routing:\n  allowedFolders:\n    - /\n"
},
"events": [
	{
		"type": "files.upload.completed",
		"contentTypes": ["image/png"],
		"filters": [
			{
				"field": "source.path",
				"operator": "pathIsUnderAny",
				"configurationPath": ["routing", "allowedFolders"]
			}
		]
	}
]
```

`source.path` + `pathIsUnderAny` expects up to 32 unique canonical absolute folder paths at `configurationPath`. `/` matches every folder, a folder matches its descendants, and an empty list disables that automatic event. Manual runs do not apply automatic event filters. The parsed YAML object is available to every backend run as `event.configuration`; it is `null` when the plugin has no configuration declaration.

## Public host APIs

Both are plain `fetch` calls against `env.BONOBO.host.apiOrigin` with `Authorization: Bearer <env.BONOBO.host.token>` — the same `/api/v1/*` machine API used by developer API keys:

| Route                              | Body                                                                                                                                                                                                 | Response                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/files/download-urls` | `BonoboFilesDownloadUrlsRequest` — `{ fileNodeIds, expiresInSeconds? }` (1–900; defaults to 900; the granted TTL is clamped below the remaining run-token lifetime with a one-second signing margin) | `BonoboFilesDownloadUrlsResponse` — `{ items, errors, truncated }`; each item contains `{ fileNodeId, url, expiresAt }` (`expiresAt` in epoch ms) |
| `POST /api/v1/files/write`         | `BonoboFilesWriteRequest` — `{ path, content, overwrite?: "replace" \| "fail" }` (`overwrite` defaults to `"replace"`)                                                                               | `BonoboFilesWriteResponse` — `{ path, nodeId, contentType }`                                                                                      |

Plugin authority is scoped to the triggering upload:

- `files/download-urls` accepts only `[event.source.fileNodeId]` for backend runs and signs the run's original asset.
- `files/write` is Markdown-only and writes siblings of the upload: `path` must be an absolute `.md` path whose parent folder equals `event.source.path`'s parent folder.

Error statuses: `400` invalid input, `401` bad or expired run token, `403` missing scope or a write path outside the upload's parent folder (the sibling constraint), `404` hidden or mismatched resource (including a `fileNodeId` that is not the run's source), `409` `overwrite: "fail"` conflict, `429` run call quota or rate limit, `500` curated storage failure. A run succeeds only if it writes at least one Markdown output.

## Typed worker example

```js
/** @type {import("bonobo-plugin-sdk").BonoboPluginHandler} */
export default {
	async fetch(request, env) {
		/** @type {import("bonobo-plugin-sdk").BonoboUploadCompletedEvent} */
		const event = await request.json();

		// plugin.secrets.read
		const apiKey = await env.BONOBO.secrets.get("OPENAI_API_KEY");
		if (!apiKey) {
			throw new Error("OPENAI_API_KEY secret is not configured");
		}

		const hostHeaders = {
			Authorization: `Bearer ${env.BONOBO.host.token}`,
			"Content-Type": "application/json",
		};

		// Host API: presigned URL for the triggering upload.
		const urlResponse = await fetch(`${env.BONOBO.host.apiOrigin}/api/v1/files/download-urls`, {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({ fileNodeIds: [event.source.fileNodeId], expiresInSeconds: 900 }),
		});
		const { items } = await urlResponse.json();
		const { url } = items[0];

		// outbound.fetch: third-party call — the origin must be in the manifest's outbound origins.
		const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "gpt-4.1-mini",
				messages: [{ role: "user", content: `Describe the image at ${url} for ${event.source.name}.` }],
			}),
		});
		const completion = await aiResponse.json();

		// Host API: write the run's Markdown output next to the upload.
		await fetch(`${env.BONOBO.host.apiOrigin}/api/v1/files/write`, {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({
				path: `${event.source.path}.description.md`,
				content: completion.choices[0].message.content,
			}),
		});

		return Response.json({ ok: true });
	},
};
```

## Frontend pages

A manifest may declare UI pages the host app embeds:

```jsonc
"pages": [
	{ "id": "gallery", "title": "Gallery", "entry": "dist/frontend/index.html", "navItem": { "label": "Gallery", "icon": "images" } }
]
```

- `id` — matches `/^[a-z0-9][a-z0-9-]{0,63}$/`, unique per manifest.
- `title` — 1–80 characters.
- `entry` — must be a manifest `files[]` entry with contentType `"text/html"`.
- `navItem` (optional) — its presence contributes a main-sidebar nav item in the host app: `label` is 1–40 characters, `icon` an optional lucide kebab-case name matching `/^[a-z0-9-]{1,64}$/`. The host currently renders only `images`, `image`, `film`, and `gallery-vertical-end`; any other name publishes fine but falls back to a generic puzzle icon (the supported set can grow without a manifest change).

### File views

A manifest may also declare file views — frames the host app offers as tabs next to the stored-file details when a workspace member opens a matching file:

```jsonc
"fileViews": [
	{ "id": "player", "title": "Video player", "entry": "dist/frontend/index.html", "contentTypes": ["video/mp4", "video/webm"] }
]
```

- `id` — same rules as page ids and shares their namespace: unique across `pages` and `fileViews` together.
- `title` — 1–80 characters. The host shows it as the view's tab label and iframe title.
- `entry` — must be a manifest `files[]` entry with contentType `"text/html"`. Pages and file views may share one entry.
- `contentTypes` — 1–32 exact stored content types (each at most 255 characters) matched against the opened file's stored content type. No wildcards. One manifest may not declare the same content type in two file views, and may declare at most 8 file views with at most 64 content types in total.
- When several installed plugins match one content type, each becomes its own tab, ordered by installation time. The file details tab stays first and opens by default.
- The host mints the view's session only for files the member can read, and only after the file's upload pipeline is complete.

### Sandbox and token model

The host loads `entry` at its immutable asset URL in an iframe with `sandbox="allow-scripts allow-same-origin allow-forms"`. Handle forms in JS (`onSubmit` + `preventDefault`); the page's CSP carries `form-action 'none'`, so a native HTTP form submission is always blocked by the browser. The page keeps the Convex asset origin, which is also the public API origin, so its normal JSON requests with a bearer header are same-origin and need no CORS preflight. The host app has a different origin, so the frame still cannot read the host DOM or host cookies. The asset URL keeps an empty query. Its fragment carries only the host's canonical HTTP(S) origin and a fresh per-frame nonce; fragments are not sent in the asset request, cache key, or referrer. Page and host use one strict postMessage contract: the page first sends the nonce-bound ready message, then receives page context, a short-lived scoped session token (`plu_...`), and the Convex deployment URL (`convexUrl`) in `bonobo:init`. Tokens and context never appear in a URL. Secret values never reach plugin frontends — `plugin.secrets.read` is backend-only.

A plugin frontend is trusted with the token and every datum its accepted permissions expose. The sandbox isolates the host DOM, cookies, and origin, but it is not a confidentiality boundary against the page code itself: page navigation can send data away before the host observes the next load and revokes the session. Plugin frames share the Convex asset origin, so plugin code must not use origin storage for secrets or as a boundary from another plugin. The host mounts only one plugin frame at a time; hidden file-view frames are unmounted.

| Direction   | Message                        | Fields                                                                                                                                      |
| ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| page → host | `bonobo:ready`                 | `bridgeNonce`                                                                                                                               |
| page → host | `bonobo:token-refresh-request` | `bridgeNonce`, `requestId`                                                                                                                  |
| host → page | `bonobo:init`                  | `bridgeNonce`, `apiOrigin`, `convexUrl`, `token`, `tokenExpiresAt` (epoch ms), `context` (union on `kind`: `"page"` carries `{ pluginName, userId, pageId, pageTitle, organizationId, workspaceId }`; `"file_view"` carries `{ pluginName, userId, fileViewId, fileViewTitle, organizationId, workspaceId, file: { fileNodeId, name, path, contentType } }`) |
| host → page | `bonobo:token`                 | `bridgeNonce`, `requestId`, `token`, `tokenExpiresAt`                                                                                       |
| host → page | `bonobo:token-error`           | `bridgeNonce`, `requestId`, `message`                                                                                                       |

`bonobo_ui_connect` (from `bonobo-plugin-sdk/frontend`) implements the page side. Before connecting, it requires exactly one canonical HTTP(S) `parentOrigin` and one UUIDv4 `bridgeNonce` in the URL fragment. It sends ready with that nonce to the exact parent origin and retries until init or document unload. The host starts minting the session while the iframe assets load, but it does not send the token until this ready message proves the current frame loaded the bridge. Every host message must come from `window.parent`, that exact origin, and the matching nonce. The host posts only to the concrete Convex asset origin. The host owns the startup deadline.

On init, the SDK also opens the page's own Convex client against `convexUrl`. The SDK closes that client on `pagehide`. A page the browser restores from its back/forward cache does not reconnect: subscriptions stay frozen until a real reload.

Do not give your page document a `no-referrer` referrer policy (for example `<meta name="referrer" content="no-referrer">`). Under that policy the browser sends `Origin: null` on the SDK's same-origin exchange POST, the server refuses it, and the page can never authenticate its Convex client.

### Plugin data on the page's own Convex client

The client's `data` and `members` APIs run as reactive queries and mutations on the page's own Convex client — not over the bridge, and not on the UI token. To authenticate it, the SDK exchanges the session token at `POST <apiOrigin>/plugins-ui/session-jwt` (same-origin, so no CORS) for a short-lived plugin-session JWT that identifies the viewing member with plugin-scoped permissions. When Convex needs a fresh JWT, the SDK exchanges again; a `401` gets one host token refresh and one re-exchange before the client goes unauthenticated. The Convex functions load the session on every call, so revoking it (uninstall, disable, upgrade, or a second load of the same frame) turns every live subscription into a `null` death — a signed-valid JWT does not outlive its session. The UI token still never carries the plugin-data write scope; page writes go through member-attributed `user*` mutations instead.

- `client.data.watch({ collection, keyPrefix?, limit }, onUpdate)` opens one reactive subscription and returns an unsubscribe function. Each update delivers the subscription's whole current window (`BonoboPublicDoc[]`) — replace it, do not accumulate. `limit` must be an integer from 1 to 100 — an out-of-range limit kills the subscription at birth with `reason: "invalid"`, nothing is clamped — and the SDK allows at most 8 active subscriptions per page (plain watches and windows share those slots). `docs: null` means the subscription is dead: the SDK delivers the `null` once (with a `BonoboUiWatchDeathInfo` when it refused locally — `reason: "invalid"` for inputs it refused, `"capacity"` for the subscription cap) and drops the registration, so a later unsubscribe is a no-op. A bare `null` without a reason means access is gone or the query failed.
- `client.data.watchWindow({ collection, keyPrefix?, pageSize }, onUpdate)` opens one reactive document window and returns `{ unsubscribe, loadOlder }`. Unlike `watch`, a window retains loaded history: new arrivals grow it instead of pushing older docs out, and `loadOlder()` extends it one `pageSize` (1..100) further into older keys while the update's `hasMore` is true. Each non-null update is a `BonoboUiDataWindowUpdate`: the whole flattened window in `docs` plus `hasMore`, `atCapacity` (the window cannot grow right now), and `incomplete` (docs are missing mid-window because an overflowing range could not be re-read). A window holds up to 6 internal reads (600 docs at `pageSize` 100) and dies with the same `null` contract as `watch`; at the internal ceiling a real `loadOlder` reports `atCapacity` instead of growing.
- `client.data.append/put/remove/putOwned/removeOwned` run one mutation each and resolve with its `Result` as-is — the per-op shapes in `BonoboUiDataWriteResult`: `append` and `putOwned` resolve `{ _yay: { key, revision, byteSize } }`, `put` resolves `{ _yay: { revision, byteSize } }`, `remove`/`removeOwned` resolve `{ _yay: { deleted } }`, and every refusal is `{ _nay: { name?, message } }`. A write never rejects: an unexpected failure resolves the stable `{ _nay: { message: "Failed to write plugin data" } }`. `put`, `remove`, `putOwned`, and `removeOwned` accept `expectedRevision` for compare-and-set: the write happens only when the stored document still has that revision (`0` means "the key must not exist yet"); a mismatch resolves `_nay` with `name: "conflict"` — re-read and decide again. Deleting and recreating a key restarts `revision` at 1, so a revision is only meaningful against a document you just read. `putOwned`/`removeOwned` write a member-owned document: it is stored under `<key>:<userId>` (the `userId` from the init context), so the caller's `key` may be at most `128 - userId.length - 1` characters.
- `client.members.resolve(userIds)` (at most 50 ids) resolves user ids to display names; a missing or deleted user maps to `null`. It never rejects: a denial or failure resolves an empty map.

### UI token API surface

With the `workspace.files.read` capability the UI token may call:

| Route                              | Scope            |
| ---------------------------------- | ---------------- |
| `POST /api/v1/files/list`          | `files:list`     |
| `POST /api/v1/files/read`          | `files:read`     |
| `POST /api/v1/files/download-urls` | `files:download` |

UI tokens are rejected on `/api/v1/files/write`.

`files/download-urls` accepts at most 100 file IDs in a 32 KB request, processes the first 20, and returns `{ items, errors, truncated }`.
Each of the first 20 requested files consumes one call from the route's principal rate-limit
bucket. One inaccessible file appears in `errors` without discarding the other successful URLs.
Duplicate file IDs are rejected with `400` before they consume route capacity or start file work.

Pagination of `/api/v1/files/list` (`{ items, cursor, isDone }`): with `contentTypePrefixes`, one request uses one bounded query. `scanLimit` sets its source-doc budget; the server defaults and caps it at 10,000 docs. The query does not set a byte-read cap. A page may come back short or even empty while `isDone` is still `false` — keep passing `cursor` until `isDone` is `true` or you have enough items. Scan with `limit: 100`, `scanLimit: 10000`, and `kind: "file"`; bound the requests advanced per user action, buffer overflow items for the next action, and retry a `429` on the same cursor.

### Frontend page example

```js
import { bonobo_ui_connect } from "bonobo-plugin-sdk/frontend";

const client = await bonobo_ui_connect();
// context is a union — narrow on kind before using kind-specific fields.
if (client.context.kind === "page") {
	document.title = client.context.pageTitle;
}

// files:list — a bounded contentTypePrefixes scan can return a short or even empty page, so
// that does not mean the listing is done. Scan wide (limit 100, scanLimit 10000, kind "file"),
// cap how many source pages one user action advances, and keep the cursor so the next action resumes; anything
// fetched beyond what is shown stays buffered for that next action.
let cursor = null;
let isDone = false;
const images = [];
for (let pages = 0; images.length < 48 && !isDone && pages < 30; pages += 1) {
	let page;
	for (let attempt = 0; ; attempt += 1) {
		try {
			page = await client.fetchJson("/api/v1/files/list", {
				body: {
					path: "/",
					recursive: true,
					kind: "file",
					limit: 100,
					scanLimit: 10_000,
					contentTypePrefixes: ["image/"],
					cursor,
				},
			});
			break;
		} catch (error) {
			// Rate limited: back off and retry the same cursor — the page is not lost and the
			// retries do not consume the page budget. Give up after two waits so a persistent
			// 429 surfaces instead of looping forever.
			if (error.status === 429 && attempt < 2) {
				await new Promise((resolve) => setTimeout(resolve, [3000, 6000][attempt]));
				continue;
			}
			throw error;
		}
	}
	images.push(...page.items);
	cursor = page.cursor;
	isDone = page.isDone;
}
// Show the first 48; keep the overflow plus `cursor` for the next "load more".
```
