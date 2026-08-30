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
- `plugin.data.user-write` — the plugin's UI pages and file views may create, change, and delete documents in that store as the acting member. The frame's UI token never carries a write scope: the write runs through the app's own member-attributed mutations on the frame's own Convex client (see [Plugin data on the frame's own Convex client](#plugin-data-on-the-frames-own-convex-client)). Declaring it also requires `plugin.data.read`.
- `ui.outbound.fetch` — the plugin's UI pages and file views may call the manifest's `uiOutboundOrigins`. It is enforced as `connect-src` in the frame's CSP, so it is the browser that refuses anything else. This capability and `uiOutboundOrigins` require each other: neither may be declared alone. Keep it separate from `outbound.fetch` — that one is the backend, this one is a frame holding a member's session token.
- `workspace.members.read` — the plugin's UI pages and file views may list every member of the workspace, as `{ userId, displayName }` rows through `client.members.list(...)`. Email is never returned. Without it a frame can still resolve names for ids it already holds (`client.members.resolve(...)`), which enumerates nobody. Every member reads the roster under one rule, including a member who signed in anonymously.

Service grant (Council only today):

The current host exchange is bound to Council. Other plugins cannot obtain a service grant yet.

- `plugin.service.connect` — lets a Council UI token from a page or a file view participate in the exchange, but grants no API scope itself. The exchange reads only the session's installation and member, so both frame kinds work the same. The Council service must also authenticate with its configured service secret. Declaring it requires `plugin.data.read` or `workspace.files.write`, because a grant carrying no scope buys the service nothing.
- `plugin.data.read` — an eligible Council grant may read the plugin's own document store.
- `plugin.data.write` — an eligible Council grant may write the plugin's document store. A frame's UI token never receives this scope, whatever the installation accepted: a UI session can belong to an anonymous identity and is the surface an XSS reaches first, so a write from there would become injected input the backend later acts on with its secrets.
- `workspace.files.write` — authorizes `files:write` on a sealed processing-phase service grant, capped by an exact destination path prefix. The interactive exchange still never mints this scope; the service gets it by sealing (below). Only the `/api/v1/files/service-uploads/*` routes accept it — the generic `/api/v1/files/*` routes still refuse service grants.
- `workspace.files.create-read-only` — lets a sealed service upload ask for a direct read-only lock on the file it creates. It cannot lock existing member files. Declaring it also requires `workspace.files.write`.

### Grant lifecycle and service upload routes (Council service only)

An interactive grant comes from `POST /api/internal/plugins/service-grants/exchange` (UI token + service secret) and carries `plugin_data:read` and `plugin_data:write` for one working day, renewable. When a meeting closes, the service seals it:

- `POST /api/internal/plugins/service-grants/seal-processing` — service secret + live interactive `psg_` bearer, body `{ destinationPathPrefix }` (a normalized absolute path of canonical lowercase folder names, not `/`). Mints a NEW processing-phase grant for the same installation and member with scopes `["plugin_data:read", "plugin_data:write", "files:write"]`, bound to exactly that prefix, expiring six days from the seal. Renewal rotates a processing token but never moves that deadline. A processing grant cannot seal again, so the window cannot roll forever. Requires all five Council capabilities and refuses if any is missing rather than minting a narrower grant.

The sealed grant then drives the upload pipeline — plain `Authorization: Bearer <psg_...>` calls (no service secret header), all POST, all requiring the `files:write` scope and the `processing` phase:

| Route                                               | Body                                                                                 | Response                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/files/service-uploads/create-target`       | `{ idempotencyKey, targetKey, path, contentType, size, readOnly, nonCollaborative }` | pending: `{ state: "pending", path, nodeId, uploadUrl, headers, uploadUrlExpiresAt }`; replay after confirm: `{ state: "committed", path, nodeId, actualBytes }` |
| `/api/v1/files/service-uploads/remint`              | `{ idempotencyKey, targetKey }`                                                      | same union as create-target: a fresh URL, or `committed`; recovery after stale cleanup replaces the pending asset                                                |
| `/api/v1/files/service-uploads/finalize`            | `{ idempotencyKey, targetKey }`                                                      | `{ state: "pending" \| "committed" \| "released", path, nodeId, actualBytes \| null }`                                                                           |
| `/api/v1/files/service-uploads/delete`              | `{ idempotencyKey, targetKey }`                                                      | `{ state: "deleted", paths }`                                                                                                                                    |
| `/api/v1/files/service-uploads/archive-destination` | `{}`                                                                                 | `{ archivedNodes }`                                                                                                                                              |

Contract highlights:

- `idempotencyKey` names one upload run (the meeting); `targetKey` names one file in it. For create, remint, and finalize, the pair is the file's identity, so a later run may reuse a target key for a different file. Replays with the same body answer the same target; the same key pair with a different body answers `409`. The target is also bound to the exact destination seal that created it. Active replay, remint, and finalize recheck the file's current path and restricted-file access. When a service call observes that a member moved the file outside that seal, it closes every old service door with a sticky moved-out fence; moving it back does not return service control. An archived file answers `404` while archived, but an ordinary member restore makes it active again. A restricted file answers `403`. A later read-only lock does not cancel an upload the host already accepted. An exact pending create replay also answers `409` while the host is deleting stale staging bytes.
- Both mode booleans are required. `readOnly: true` needs `workspace.files.create-read-only` and the acting member's live permission to manage the destination ACL. The host locks only the new placeholder and records the exact target that created that lock. `nonCollaborative: true` is valid only for an editable-text filename. The empty placeholder stays a normal blob; after valid UTF-8 text conversion succeeds, the file stores chunks and one content snapshot with no Yjs asset or Yjs docs. A failed conversion stays a blob and leaves `nonCollaborative` unset.
- `create-target` is closed to workspaces on the `Free` plan. Storing files costs real money, so only a workspace whose payer is on `Pay As You Go` or `Pro` may store service files; anything else answers `403`. In an owner-billed organization the owner's plan decides, not the acting member's. A target the host already accepted keeps working even if the plan drops afterwards — remint, finalize, and delete still answer. Only a new target is refused.
- There is nothing to book first, and `create-target` charges nothing. The `size` you send is only a guess, so the workspace's 10 GiB `plugin_service_storage_bytes` quota is charged once, for the size R2 confirms for the stored file. `create-target` answers `403` only when that quota is already full. The counter only grows: deleting a stored file gives nothing back. An upload you abandon costs nothing, because no bytes were ever stored. At most 16 targets may be created in one upload run. One destination may also hold at most 16 reachable pending or committed targets under the same target key across runs; moved-out and released history does not count. An exact replay of an existing target still works at either cap.
- Every `path` must live strictly under the sealed `destinationPathPrefix`; anything else answers `403 Path is outside this grant's destination`. Paths use the app's canonical form: lowercase folder segments, real upload file names.
- Upload with a signed PUT to `uploadUrl` (send exactly the returned `headers`), then poll `finalize` until `state` is `"committed"`. `remint` when the 15-minute URL expired mid-retry. `finalize` answering `"released"` means the upload window is gone for good — retry under a new `targetKey`. The R2 event confirms the object, atomically records its actual size, and charges it. Finalize reports that settlement. The size you declared never reaches the bill.
- A target you create is a real, empty file in the workspace from that moment. If your service crashes before the PUT, the empty file stays there and a member can delete it. After eight days the host deletes only stale staging bytes; it keeps the placeholder and target. `remint` and an exact pending `create-target` replay answer `409` while that deletion job is still open. After it settles, the retry reuses the same staging key and you send the whole file again — there is no resume. A delayed event still closes the old service doors if the current file moved outside the seal. A read-only placeholder defers the stale-byte cleanup and both retry calls stay available, because a later lock does not cancel an accepted upload. Cancel the target with `delete` when you know the upload will not happen.
- `delete` handles every reachable pending or committed file that an installation stored under a `targetKey`, across upload runs in the sealed destination. Its `idempotencyKey` does not narrow that cleanup to one run. Moved-out member-owned files are outside this door. The host checks each active file's current path and restricted-file write access before it changes anything. A restricted file answers `403`; a member lock answers `409`. The only lock exception is the direct read-only lock created by the exact live target, while the capability is still accepted and the actor still manages that file's ACL. An unlock and later member relock removes this exception. It works days later under a NEW grant sealed to the same destination. A committed upload is a normal member file, so the host archives it and keeps its content, metadata, and stored object. An unfinished upload is only an empty placeholder, so the host cancels it and deletes its temporary files. Both answer `"deleted"` in the same request. Council uses `archive-destination` instead because deleting a meeting must keep its whole folder as one restorable set. Released history is not enumerated, so a replay may return one representative path instead of every old path. A late staging event after a pending cancel or after a member discarded the failed placeholder still records the largest actual size and charges those stored bytes before deleting both possible object keys. A moved-out accepted upload still finishes and charges its real size, but its old service doors stay closed. A committed target keeps its canonical size when later staging events arrive. Nothing is ever refunded. An unknown key answers `404`. Replays keep answering.
- `archive-destination` archives the whole destination folder, with every file still inside it, for the delete-meeting workflow. The body is empty on purpose: the seal names the folder, so the grant can never reach another one. Archiving is what "delete a file" means to a member — the folder leaves the file tree in one archive operation, so a member can restore the exact set. This call closes the current logical epoch under the same installation and seal. Restoring a folder from that closed epoch does not reopen its service calls, consume the live target cap, or let an archive replay take it again. A later create opens the next epoch. If a member restores an older service-created folder before its epoch was closed, the archive route can handle it after proving its stable id. A member-only folder that merely reused the path is never touched. Stored bytes stay charged; this quota never gives bytes back. A destination that was never created, or one a member already archived, answers `{ archivedNodes: 0 }`, so a replayed delete is happy. Before any archive write, the host validates the whole subtree. Restricted content answers `403`. Member, inherited, stale-target, or unrelated locks answer `409`; only the same exact live-target lock exception described above is allowed.
- The seal validates the destination as-is and refuses non-canonical folder names with `400`. Normalize your configured folder before sealing (for example `/Meetings` → `/meetings`); the host never normalizes it for you.
- Error statuses: `400` invalid input, `401` dead grant/installation/membership, `403` missing scope, wrong phase, destination fence, a plan that does not include service file storage, or a full quota, `404` unknown target (including another workspace's), `409` idempotency conflicts, replay-after-release, or staging cleanup still in progress.

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

`source.path` + `pathIsUnderAny` expects up to 32 unique canonical absolute folder paths at `configurationPath`. `/` matches every folder, a folder matches its descendants, and an empty list disables that automatic event. Manual runs do not apply automatic event filters. A manual or backfill re-run delivers the same `source` with `event: "files.run.requested"` instead of `"files.upload.completed"`. The parsed YAML object is available to every backend run as `event.configuration`; it is `null` when the plugin has no configuration declaration.

## Public host APIs

These are plain `fetch` calls against `env.BONOBO.host.apiOrigin` with `Authorization: Bearer <env.BONOBO.host.token>` — the same `/api/v1/*` machine API used by developer API keys:

| Route                              | Body                                                                                                                                                                                                       | Response                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/files/download-urls` | `BonoboFilesDownloadUrlsRequest` — `{ fileNodeIds, expiresInSeconds? }` (1–900; defaults to 900; the granted TTL is clamped below the remaining run-token lifetime with a one-second signing margin)       | `BonoboFilesDownloadUrlsResponse` — `{ items, errors, truncated }`; each item contains `{ fileNodeId, url, expiresAt }` (`expiresAt` in epoch ms) |
| `POST /api/v1/files/write`         | `BonoboFilesWriteRequest` — `{ path, content, overwrite?: "replace" \| "fail" }` (`overwrite` defaults to `"replace"`)                                                                                     | `BonoboFilesWriteResponse` — `{ path, nodeId, contentType }`                                                                                      |
| `POST /api/v1/files/touch`         | `BonoboFilesTouchRequest` — `{ paths }` (at most 8 paths per call; the call is idempotent)                                                                                                                 | `BonoboFilesTouchResponse` — `{ files }`; each entry is `{ path, nodeId, created }`, and `created` is `false` when the file already existed       |
| `POST /api/v1/activities/start`    | `BonoboActivitiesStartRequest` — `{ title, timeoutMs }` (`title` up to 120 characters after trimming, or `""` to let the host compose one; `timeoutMs` at most `300000`, and a larger value answers `400`) | `BonoboActivitiesStartResponse` — `{ activityId }`; a second call in the same run answers `409`                                                   |

Plugin authority is scoped to the triggering upload:

- `files/download-urls` accepts only `[event.source.fileNodeId]` for backend runs and signs the run's original asset.
- `files/write` is Markdown-only and writes siblings of the upload: `path` must be an absolute `.md` path whose parent folder equals `event.source.path`'s parent folder.
- `files/touch` creates those same siblings empty, so users see where the outputs will land before the run fills them. Every path follows the `files/write` rule above, and a later `files/write` fills the node it already made.
- `activities/start` is optional: a run that never calls it stays out of the workspace activity feed. After a run opts in, the host tracks the rest — the files the run touches or writes become the activity's targets, and the run's own outcome closes it.

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

The host loads `entry` at its immutable asset URL in an iframe with `sandbox="allow-scripts allow-same-origin allow-forms"`. Handle forms in JS (`onSubmit` + `preventDefault`); the frame's CSP carries `form-action 'none'`, so a native HTTP form submission is always blocked by the browser. The frame keeps the Convex asset origin, which is also the public API origin, so its normal JSON requests with a bearer header are same-origin and need no CORS preflight. The host app has a different origin, so the frame still cannot read the host DOM or host cookies. The asset URL keeps an empty query. Its fragment carries only the host's canonical HTTP(S) origin and a fresh per-frame nonce; fragments are not sent in the asset request, cache key, or referrer. Frame and host use one strict postMessage contract: the frame first sends the nonce-bound ready message, then receives its context, a short-lived scoped session token (`plu_...`), and the Convex deployment URL (`convexUrl`) in `bonobo:init`. Tokens and context never appear in a URL. Secret values never reach plugin frontends — `plugin.secrets.read` is backend-only.

A plugin frontend is trusted with the token and every datum its accepted permissions expose. The sandbox isolates the host DOM, cookies, and origin, but it is not a confidentiality boundary against the frame's own code: a navigation inside the frame can send data away before the host observes the next load and revokes the session. Plugin frames share the Convex asset origin, so plugin code must not use origin storage for secrets or as a boundary from another plugin. The host mounts only one plugin frame at a time; hidden file-view frames are unmounted.

| Direction    | Message                        | Fields                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frame → host | `bonobo:ready`                 | `bridgeNonce`                                                                                                                                                                                                                                                                                                                                                                                        |
| frame → host | `bonobo:token-refresh-request` | `bridgeNonce`, `requestId`                                                                                                                                                                                                                                                                                                                                                                           |
| host → frame | `bonobo:init`                  | `bridgeNonce`, `apiOrigin`, `convexUrl`, `token`, `tokenExpiresAt` (epoch ms), `context` (union on `kind`: `"page"` carries `{ pluginName, userId, pageId, pageTitle, organizationId, workspaceId }`; `"file_view"` carries `{ pluginName, userId, fileViewId, fileViewTitle, organizationId, workspaceId, file: { fileNodeId, name, path, contentType } }`), `theme` (optional: `{ mode, tokens }`) |
| host → frame | `bonobo:theme`                 | `bridgeNonce`, `theme`                                                                                                                                                                                                                                                                                                                                                                               |
| host → frame | `bonobo:token`                 | `bridgeNonce`, `requestId`, `token`, `tokenExpiresAt`                                                                                                                                                                                                                                                                                                                                                |
| host → frame | `bonobo:token-error`           | `bridgeNonce`, `requestId`, `message`                                                                                                                                                                                                                                                                                                                                                                |

`bonobo_ui_connect` (from `bonobo-plugin-sdk/frontend`) implements the frame side. Before connecting, it requires exactly one canonical HTTP(S) `parentOrigin` and one UUIDv4 `bridgeNonce` in the URL fragment. It sends ready with that nonce to the exact parent origin and retries until init or document unload. The host starts minting the session while the iframe assets load, but it does not send the token until this ready message proves the current frame loaded the bridge. Every host message must come from `window.parent`, that exact origin, and the matching nonce. The host posts only to the concrete Convex asset origin. The host owns the startup deadline.

On init, the SDK also opens the frame's own Convex client against `convexUrl`. The SDK closes that client on `pagehide`. A frame the browser restores from its back/forward cache does not reconnect: subscriptions stay frozen until a real reload.

Do not give your frame document a `no-referrer` referrer policy (for example `<meta name="referrer" content="no-referrer">`). Under that policy the browser sends `Origin: null` on the SDK's same-origin exchange POST, the server refuses it, and the frame can never authenticate its Convex client.

### Plugin data on the frame's own Convex client

The client's `data`, `members` and `scopes` APIs run as reactive queries and mutations on the frame's own Convex client — not over the bridge, and not on the UI token. To authenticate it, the SDK exchanges the session token at `POST <apiOrigin>/plugins-ui/session-jwt` (same-origin, so no CORS) for a short-lived plugin-session JWT that identifies the viewing member with plugin-scoped permissions. When Convex needs a fresh JWT, the SDK exchanges again; a `401` gets one host token refresh and one re-exchange before the client goes unauthenticated. The Convex functions load the session on every call, so revoking it (uninstall, disable, upgrade, or a second load of the same frame) turns every live subscription into a `null` death — a signed-valid JWT does not outlive its session. The UI token still never carries the plugin-data write scope; frame writes go through member-attributed `user*` mutations instead.

- `client.data.watch({ collection, keyPrefix?, limit }, onUpdate)` opens one reactive subscription and returns an unsubscribe function. Each non-null update is a `BonoboUiDataWatchUpdate`: the subscription's whole current window in `docs` — replace it, do not accumulate — plus `truncated`, which says the read hit `limit` and the docs past it are not in `docs`. A plain watch cannot reach those at all, so use `watchWindow` when the page must show everything. `limit` must be an integer from 1 to 100 — an out-of-range limit kills the subscription at birth with `reason: "invalid"`, nothing is clamped — and the SDK allows at most 16 active subscriptions per frame (plain watches and windows share those slots). A second ceiling is a backstop for a buggy or hostile page, not a budget honest plugins design against: the frame holds at most 100 server subscriptions, one per plain watch and one per window interval. Slots and intervals are what shape a page — 16 fully-grown windows spend 96, which stays under 100. An update of `null` in place of that object means the subscription is dead: the SDK delivers the `null` once with a `BonoboUiWatchDeathInfo` naming the reason, then drops the registration, so a later unsubscribe is a no-op. There are five reasons, and a page should not show the same message for all of them: `"invalid"` (the watch inputs failed the client-side checks), `"capacity"` (the frame already holds too many live subscriptions), `"denied"` (the store refused the read — the plugin was uninstalled, or its data was removed), `"session_expired"` (the frame's session ran out, and a reload gets a new one), and `"unavailable"` (the data connection failed). The info is absent only when the SDK could not start the subscription at all, and that failure is already visible at the call site.
- `client.data.watchRecent({ collection, limit, order?, since?, before?, scopeId? }, onUpdate)` opens one reactive subscription on the newest documents of `collection`, ordered by creation time — which key order cannot answer for keys that carry no timestamp. Pass `scopeId` to read one private scope instead of the public half; this read has no key range to resolve a scope from. Edits and deletions never move a document in this order: a tombstoned doc keeps its creation-time slot, so read its value's own deletion marker. Everything else is `watch`'s contract: the same `BonoboUiDataWatchUpdate` deliveries (replace, do not accumulate; read `truncated`), the same `null` death with the same reasons, the same 1..100 `limit` rule, and the same frame slot and server subscription spend. `order` defaults to `"asc"`, and each fencepost belongs to one direction: `since` (exclusive lower bound, ms — the catch-up read) only with ascending, `before` (exclusive upper bound, ms — the feed read) only with descending; copy either from a delivered doc's `createdAt`. The server judges the pairing, and a violation kills the subscription with a bare `null` like any other refused read.
- `client.data.watchChanges({ collection, limit, updatedSince?, scopeId? }, onUpdate)` opens one reactive subscription on documents of `collection` that changed at or after `updatedSince`, ordered by update time. Pass `scopeId` to read one private scope instead of the public half. An edit and a soft-delete both bump `updatedAt` and surface here — that is the point, and it is why this is not `watchRecent`. A physically deleted document is gone from the table and cannot appear. `updatedSince` is an inclusive lower bound: copy it from the newest `updatedAt` you have already applied; omit it to start from the oldest update. A write batch stamps every document with one `Date.now()`, so a change whose `updatedAt` equals the cursor must still be delivered. Over-delivery of that millisecond is free (merge by key and revision). Advance the cursor only when a later `updatedAt` arrives, or the same-millisecond re-delivery will re-subscribe in a loop. If a delivery is truncated and every document is still on the cursor millisecond, pass `newest + 1` so the live query can leave those 100 rows. That step can permanently skip tied rows past the first 100 when 101 or more documents in one collection and scope share the same `Date.now()` millisecond, reachable only through parallel bulk imports on the batch door (three 50-document mutations in one millisecond); replies and reactions have no heal for it, and messages heal one page. Everything else is `watch`'s contract: the same `BonoboUiDataWatchUpdate` deliveries, the same `null` death with the same reasons, the same 1..100 `limit` rule, and the same frame slot and server subscription spend.
- `client.data.watchWindow({ collection, keyPrefix?, pageSize }, onUpdate)` opens one reactive document window and returns `{ unsubscribe, loadOlder }`. Unlike `watch`, a window retains loaded history: new arrivals grow it instead of pushing older docs out, and `loadOlder()` extends it one `pageSize` (1..100) further into older keys while the update's `hasMore` is true. Each non-null update is a `BonoboUiDataWindowUpdate`: the whole flattened window in `docs` plus `hasMore`, `atCapacity` (the window cannot grow right now), and `incomplete` (docs are missing mid-window because an overflowing range could not be re-read). Re-reading a range splits it in two, so the repair needs a free interval and two free frame subscriptions; `incomplete` stays false while a repair runs, and once it turns true the window does not get those docs back on its own. A window holds up to 6 internal reads (600 docs at `pageSize` 100) and dies with the same `null` contract as `watch`; at the internal ceiling a real `loadOlder` reports `atCapacity` instead of growing. The frame's 100 server subscriptions are a backstop for buggy or hostile pages, and every interval of every window spends one — slots and intervals are what shape a page (16 × 6 = 96). A window reports `atCapacity` and refuses to grow when its own 6 reads are used, or if that backstop is gone, and a new window opened on a spent backstop dies at birth with `reason: "capacity"`.
- `client.data.append/put/remove/putOwned/removeOwned` run one mutation each and resolve with its `Result` as-is — the per-op shapes in `BonoboUiDataWriteResult`: `append` and `putOwned` resolve `{ _yay: { key, revision, byteSize } }`, `put` resolves `{ _yay: { revision, byteSize } }`, `remove`/`removeOwned` resolve `{ _yay: { deleted } }`, and every refusal is `{ _nay: { name?, message } }`. A write never rejects: an unexpected transport or runtime failure resolves the stable `{ _nay: { name: "unavailable", message: "Failed to write plugin data" } }`, so a plugin can tell that uncertain outcome from a definite backend refusal. `put`, `remove`, `putOwned`, and `removeOwned` accept `expectedRevision` for compare-and-set: the write happens only when the stored document still has that revision (`0` means the caller read no target document); a mismatch resolves `_nay` with `name: "conflict"` — re-read and decide again. Deleting and recreating a key restarts `revision` at 1, so a revision is only meaningful against a document you just read. `append` creates a member-owned document (`ownership: "owned"`): only the appending member may later change or delete it through interactive writers. `putOwned`/`removeOwned` write a member-owned document under `<key>:<userId>` (the `userId` from the init context), so the caller's `key` may be at most `128 - userId.length - 1` characters. A create-only `putOwned` (`expectedRevision: 0`) replaces a normal shared document squatting that server-composed key with a fresh owned document at revision 1; a versioned producer document or another member's owned document still refuses.
- `client.members.resolve(userIds)` (at most 50 ids) resolves user ids to display names; a missing or deleted user maps to `null`. It never rejects: a denial or failure resolves an empty map.
- `client.members.list({ limit, cursor? })` reads one page of the workspace roster. The order is stable but carries no meaning — it follows the internal user id — so sort the rows yourself before showing them. A row is `{ userId, displayName }` and nothing else — email is never returned, and `displayName` is `null` for a member with no profile name, which includes a member who signed in anonymously. `limit` must be an integer from 1 to 100. Pass the previous answer's `cursor` for the next page; a `null` cursor means that was the last page. This needs the `workspace.members.read` capability, which `resolve` above does not: resolving names for ids the plugin already holds enumerates nobody, and this reads the list itself. It never rejects, and a refusal never looks like an empty workspace: success resolves `{ _yay: { members, cursor } }` and every refusal resolves `{ _nay: { name, message } }`. `name` uses the same words as a watch death plus one of its own — `"not_consented"` (this workspace never accepted `workspace.members.read`; an admin accepting the plugin's current permissions fixes it), `"invalid"` (the `limit` failed the client-side check), `"denied"` (the frame's access is gone), `"session_expired"`, and `"unavailable"`.
- `client.scopes.*` makes part of the store private — a private channel, a direct message, or anything else only some members may read. A scope covers one key prefix across the collections it names, every document written under that prefix carries it, and every read door hides those documents from a member the scope does not name. `create({ scopeId, collections, keyPrefix })` mints one and gives the caller the first `manage` grant; name **every** collection the private area spans in that one call, because a scope built one collection at a time leaves the rest readable in between and costs the member one scope per collection. The key range must be free: no other scope may overlap it and no document may already sit in it, so create the scope before writing anything under the prefix. A scope id and its key range can never be reused during that installation's lifetime, even when the scope was empty. This keeps an old frame from sending private data as public after deletion. When the first document is what makes the private area visible, use `createWithDocument({ scopeId, collections, keyPrefix, principals, document })`. It creates the scope, the invited principals, and one shared document in one transaction. A new setup uses one page-write rate charge, so a refused invite or document cannot leave an empty scope behind. An exact retry returns the stored success without a second charge. The creator gets `manage` automatically and must not appear in `principals`; the document must sit inside the new range. `setPrincipal({ scopeId, userId, level })` adds somebody or changes their level (`"member"` reads and writes; `"manage"` also changes who else is in it). The host refuses this call when a manager tries to change their own level to `"member"`; use `removePrincipal` to leave. `removePrincipal({ scopeId, userId, expectedPrincipalCount? })` takes them out. Taking somebody else out needs `manage`; taking yourself out is allowed while you are in the scope. A last-person leave deletes the scope and its grants. When the last manager leaves a shared scope, the host gives `manage` to the remaining member with the lowest stable user ID, so the scope never loses its manager. `delete({ scopeId, expectedPrincipalCount? })` removes the scope with every grant on it and needs `manage`. The documents stay until the plugin is uninstalled. Pass `expectedPrincipalCount` when the page promised one outcome; a changed count is refused with `name: "conflict"` before any write. All five changes resolve `{ _yay: { scopeId, deleted, membershipRevision } }` or `{ _nay: { name?, message } }` the way a data write does, never rejecting. A transport or runtime failure resolves `{ _nay: { name: "unavailable", message: "Failed to change who can read this" } }`, so the page can tell an uncertain call from a definite backend refusal. `deleted` says whether that call removed the scope. `membershipRevision` increases on every successful change to that scope's members or levels. Compare it with the same field from `watchMine` when an old Leave reply can race a manager adding the member back. A lifecycle change gives the same opaque answer for an unreadable live scope and an absent or released one; an unreadable live range and a released range also give the same opaque overlap answer. An exact create retry succeeds only when the caller can still read that scope. `listPrincipals({ scopeId })` reads who is in it. An organization owner receives the full principal list without a scope grant. For any other caller, `{ _yay: null }` means the scope does not name them or does not exist. Compare the returned user ids with the caller's own user id; a non-null list alone does not prove membership. A query failure or malformed response is separate: `{ _nay: { name: "unavailable", message: "Failed to read who can access this" } }`. The call never rejects.
  `listPrincipals` returns active workspace members only. It omits inactive or deleted members whose grants are waiting for cleanup, and `expectedPrincipalCount` compares that same active list. A last-person leave therefore means the last active person.
  Three rules for the page. **Do not render a placeholder for what a member cannot read** — an unreadable scope's documents simply never arrive, so a list built from a watch shows nothing for it, and a "locked channel" row would tell the member the channel exists, which is the one thing the scope is for. **Say that the organization owner reads everything**: the owner passes every permission check before any grant is read, so copy that says "private" without saying that is a disclosure. **Plan for the caps**: a member may hold at most 50 scopes, a scope may name at most 50 people, and one installation may create at most 1,000 scope ids over its lifetime. Create number 1,001 returns `storage_full`; uninstall and reinstall resets that installation limit. A page that creates scopes must let members leave one too.

  `scopes.watchMine(onUpdate)` lists the scopes this member is in, live, and returns the unsubscribe function. **A page needs this to find its own private areas again.** Your plugin mints the scope id, and from then on it lives only inside the key range it hides, so a read with no key range answers only the public part of the store and cannot reach it. Without this call a member creates a private channel and it disappears from the list, for everybody including the person who made it. Read this first, then open one ranged read per scope beside your public one. Keep the last live scope list when `watchMine` dies. Drop cached scope documents only when a later non-null `watchMine` update no longer names that scope; a ranged read death alone may be a connection or capacity failure and does not prove departure. Each scope arrives as `{ scopeId, keyPrefix, collections, appendActivity, level, membershipRevision }`. `appendActivity` is sorted by collection and contains `{ collection, at, createdByUserId, sequence }` for each private collection with a successful append. It is durable, and the append document and activity commit in one transaction. `sequence` increases for every new accepted append in that collection, including two appends in the same millisecond. The activity never exposes the append key. `membershipRevision` is separate: it increases only for a successful membership or level change. It lets a page tell a stale Leave reply from a later re-add even when the live query merges both server changes into one final delivery. It is a watch, so somebody adding this member to a range reaches the page without a reload; it spends one subscription slot and dies like any other watch. Listing follows the grant, not the workspace: the organization owner may read every scope but is only listed the ones they were added to.

- `client.theme.current()` returns the host's theme — `{ mode: "light" | "dark", tokens }` — or `null` when the host sent none. A plugin frame is a separate document and inherits none of the host's colours, so the host resolves its palette and sends the finished CSS values, one per role: `surface`, `surfaceRaised`, `surfaceOverlay`, `surfaceHover`, `border`, `borderStrong`, `text`, `textMuted`, `textSubtle`, `accent`, `accentHover`, `selection`, `success`, `danger`. Write them into your own custom properties once and style against those. `client.theme.subscribe(onChange)` calls `onChange` on every later theme the host sends — the member switching the app's theme — and returns the unsubscribe function. It never fires for the current theme, so read `current()` first.

### UI token API surface

With the `workspace.files.read` capability the UI token may call:

| Route                              | Scope            |
| ---------------------------------- | ---------------- |
| `POST /api/v1/files/list`          | `files:list`     |
| `POST /api/v1/files/read`          | `files:read`     |
| `POST /api/v1/files/download-urls` | `files:download` |

UI tokens are rejected on `/api/v1/files/write`.

`client.fetchJson(...)` answers `Promise<unknown>`. The value comes from outside the page, so check the shape before reading fields off it. The pagination rule below is the reason: a listing page may come back short or even empty while `isDone` is still `false`.

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
			// fetchJson rejects with an Error carrying `status` only on a non-ok response. A
			// network failure rejects with something else, so read `status` only after checking
			// for it — the video player's `get_error_status` is this same guard as a helper.
			const status =
				error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : undefined;
			// Rate limited: back off and retry the same cursor — the page is not lost and the
			// retries do not consume the page budget. Give up after two waits so a persistent
			// 429 surfaces instead of looping forever.
			if (status === 429 && attempt < 2) {
				await new Promise((resolve) => setTimeout(resolve, [3000, 6000][attempt]));
				continue;
			}
			throw error;
		}
	}
	// fetchJson answers `unknown` — this body came from outside the page, so check its shape
	// before reading fields off it. Council's `as_record` is this same guard as a helper.
	const listing =
		typeof page === "object" && page !== null && !Array.isArray(page)
			? /** @type {{ items?: unknown, cursor?: unknown, isDone?: unknown }} */ (page)
			: null;
	if (!listing || !Array.isArray(listing.items)) {
		throw new Error("/api/v1/files/list answered an unexpected shape");
	}
	images.push(...listing.items);
	cursor = typeof listing.cursor === "string" ? listing.cursor : null;
	isDone = listing.isDone === true;
}
// Show the first 48; keep the overflow plus `cursor` for the next "load more".
```
