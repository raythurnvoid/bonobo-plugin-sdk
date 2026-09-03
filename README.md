# Bonobo Plugin SDK

SDK for Bonobo workspace plugins. The root export is types-only (a single hand-written `index.d.ts` built on `@cloudflare/workers-types`) — plugin workers are plain Cloudflare-style JS typed via JSDoc. The `bonobo-plugin-sdk/frontend` export adds a small hand-written browser ESM runtime for plugin UI pages and file views (see [Frontend pages](#frontend-pages)).

## Capabilities

A plugin manifest declares capabilities (`BonoboCapability`), which a workspace consents to on install. A capability may authorize more than one caller, so each entry below names every caller it reaches.

Backend run (`fetch(request, env, ctx)`):

- `plugin.secrets.read` — `env.BONOBO.secrets.get(name)` resolves the publisher secret (or the workspace's shadowing installation secret) or `null`.
- `outbound.fetch` — native `fetch` to third-party HTTPS origins listed in the manifest's `outboundOrigins`.
- `plugin.data.read` — read the plugin's own document store.
- `plugin.data.write` — create, change, and delete documents in that store. Declaring it also requires `plugin.data.read`.
- `workspace.files.read` — the run's host token also carries `files:list` and `files:read`, so a backend run can call `/api/v1/files/list` and `/api/v1/files/read` with the acting member's visibility: a file or folder that member cannot see answers `404` or an empty page. `files/download-urls` stays bound to the triggering upload.
- `workspace.files.own-write` — an invoke run (below) may create folders the plugin owns through `/api/v1/files/plugin-folders/ensure` and write Markdown inside them with `files/write`. Every node it creates carries the plugin's ownership stamp, and the write doors refuse any path whose existing chain does not carry that stamp, so this opens no write over a member's own files. Members cannot share or lock a stamped node. Declaring it also requires `workspace.files.write`.
- `workspace.files.own-access` — the run may lock its own stamped files and folders read-only, release those locks again, or bind a stamped node's readers to one of the plugin's private data scopes, through `/api/v1/files/plugin-access/set`. It only ever applies to nodes carrying this plugin's stamp. Declaring it also requires `workspace.files.own-write`.

Plugin page and file view (the sandboxed iframe):

- `workspace.files.read` — read access to workspace files: the frame's UI token carries the `files:list`, `files:read`, and `files:download` scopes. The same capability also reaches backend runs (see the backend list above).
- `plugin.data.read` — read the plugin's own document store; the UI token carries `plugin_data:read`.
- `plugin.data.user-write` — the plugin's UI pages and file views may create, change, and delete documents in that store as the acting member. The frame's UI token never carries a write scope: the write runs through the app's own member-attributed mutations on the frame's own Convex client (see [Using the Convex client](#using-the-convex-client)). Declaring it also requires `plugin.data.read`.
- `ui.outbound.fetch` — the plugin's UI pages and file views may call the manifest's `uiOutboundOrigins`. It is enforced as `connect-src` in the frame's CSP, so it is the browser that refuses anything else. This capability and `uiOutboundOrigins` require each other: neither may be declared alone. Keep it separate from `outbound.fetch` — that one is the backend, this one is a frame holding a member's session token.
- `workspace.members.read` — the plugin's UI pages and file views may list every member of the workspace, as `{ userId, displayName }` rows through the `list_members` door on the frame's Convex client. Email is never returned. Without it a frame can still resolve names for ids it already holds (the `resolve_member_display` door), which enumerates nobody. Every member reads the roster under one rule, including a member who signed in anonymously.
- `plugin.backend.invoke` — the plugin's UI pages and file views may run the plugin's backend on demand through `client.backend.invoke(...)` (`POST /api/v1/plugin-backend/invoke` on the UI token). The manifest must declare `backend.endpoints`; the capability and the endpoint list require each other. It is its own consent because "a member's click runs publisher code that can write" is different from "an upload runs it".

Service grant (publisher-registered services):

The host exchange works for any plugin whose publisher registered a service secret with the host; the publisher settings screen issues the secret once and can rotate it. A plugin with no registration cannot obtain a service grant. Council is the only registered service today.

- `plugin.service.connect` — lets the plugin's UI token from a page or a file view participate in the exchange, but grants no API scope itself. The exchange reads only the session's installation and member, so both frame kinds work the same. The service must also authenticate with the publisher's registered service secret. Declaring it requires `plugin.data.read` or `workspace.files.write`, because a grant carrying no scope buys the service nothing.
- `plugin.data.read` — an eligible service grant may read the plugin's own document store.
- `plugin.data.write` — an eligible service grant may write the plugin's document store. A frame's UI token never receives this scope, whatever the installation accepted: a UI session can belong to an anonymous identity and is the surface an XSS reaches first, so a write from there would become injected input the backend later acts on with its secrets.
- `workspace.files.write` — authorizes `files:write` on a sealed processing-phase service grant, capped by an exact destination path prefix. The interactive exchange still never mints this scope; the service gets it by sealing (below). A sealed grant may call the `/api/v1/files/service-uploads/*` routes, `/api/v1/files/write` (Markdown inside the sealed destination; a create stamps the file as service-written, and a fill requires that stamp from the same plugin), and `/api/v1/files/plugin-archive`. Every other generic `/api/v1/files/*` route still refuses service grants.
- `workspace.files.create-read-only` — lets a sealed service upload ask for a direct read-only lock on the file it creates. It cannot lock existing member files. Declaring it also requires `workspace.files.write`.

### Grant lifecycle and service upload routes

An interactive grant comes from `POST /api/internal/plugins/service-grants/exchange` (UI token + registered service secret) and carries the publisher's registered scopes minus `files:write` — for Council's registration, `plugin_data:read` and `plugin_data:write` — for one working day, renewable. When the service's processing work begins (for Council: when a meeting closes), the service seals it:

- `POST /api/internal/plugins/service-grants/seal-processing` — service secret + live interactive `psg_` bearer, body `{ destinationPathPrefix }` (a normalized absolute path of canonical lowercase folder names, not `/`). Mints a NEW processing-phase grant for the same installation and member with exactly the registered scopes (for Council: `["plugin_data:read", "plugin_data:write", "files:write"]`), bound to exactly that prefix, expiring six days from the seal. Renewal rotates a processing token but never moves that deadline. A processing grant cannot seal again, so the window cannot roll forever. Requires `plugin.service.connect` plus the workspace capability gating each registered scope, and refuses if any is missing rather than minting a narrower grant. `workspace.files.create-read-only` is deliberately not required here; `create-target` still checks it on every call.

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

These are plain `fetch` calls against `env.BONOBO.host.apiOrigin` with `Authorization: Bearer <env.BONOBO.host.token>` — the same `/api/v1/*` machine API used by developer API keys.

Their shapes are generated from the app into `bonobo-plugin-sdk/http-api`, so this package no longer keeps a second copy of them. Index the generated table by route, method, and status:

```ts
import type { BonoboHttpApi } from "bonobo-plugin-sdk/http-api";

type WriteBody = BonoboHttpApi["/api/v1/files/write"]["POST"]["body"];
type WriteOk = BonoboHttpApi["/api/v1/files/write"]["POST"]["response"][200]["body"];
```

0.16.0 breaks two things and ships no deprecated aliases:

- The `Bonobo*Request` and `Bonobo*Response` interfaces, and `BonoboPublicDoc`, are gone. The rules that lived in their doc blocks are in the table and the notes below it. Read the shapes off `BonoboHttpApi` instead.
- `client.fetchJson` takes a generated route path instead of any `string`, and its `body` is typed from that path. A helper that forwards `path: string` and `body: unknown` no longer compiles; make it generic over the path, the way the "UI token API surface" section shows.

| Route                              | Body                                                                                                                                                                                                                                                              | Response                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/files/download-urls` | `{ fileNodeIds, expiresInSeconds? }` (1–900; defaults to 900; the granted TTL is clamped below the remaining run-token lifetime with a one-second signing margin)                                                                                                 | `{ items, errors, truncated }`; each item is `{ fileNodeId, url, expiresAt }` (`expiresAt` in epoch ms) and each error is `{ fileNodeId, message }` |
| `POST /api/v1/files/write`         | `{ path, content, overwrite?: "replace" \| "fail", access?: { readOnly?: boolean } }` — V1 writes Markdown only. `overwrite` defaults to `"replace"`; writing over an existing editable Markdown file replaces its content in place and keeps the same `nodeId`.  | `{ path, nodeId, contentType }`                                                                                                                   |
| `POST /api/v1/files/touch`         | `{ paths }` — creates empty editable Markdown files, at most 8 per call, so members see where a run's outputs will land before the run fills them. Paths follow the `files/write` rule. The call is idempotent.                                                   | `{ files }`; each entry is `{ path, nodeId, created }`, and `created` is `false` when the file already existed                                     |
| `POST /api/v1/activities/start`    | `{ title, timeoutMs }` (`title` up to 120 characters after trimming, or `""` to let the host compose one; `timeoutMs` at most `300000`, and a larger value answers `400`)                                                                                         | `{ activityId }`; a second call in the same run answers `409`                                                                                      |
| `POST /api/v1/plugin-data/read`    | `{ collection, key }`                                                                                                                                                                                                                                             | `{ document }` — one stored document, or `null` when the key does not exist                                                                        |
| `POST /api/v1/plugin-data/list`    | `{ collection, keyPrefix?, keyStartExclusive?, keyEndInclusive?, cursor?, limit? }`                                                                                                                                                                                | `{ documents, cursor, isDone }`                                                                                                                    |

`access: { readOnly: true }` on a `files/write` create locks the new file with a lock the plugin itself can pass and release. It needs `workspace.files.own-access` (or the service seal's create-read-only consent) and is refused for API-key callers.

Call `activities/start` once, and call it early. The host only collects targets after the activity exists, so files a run writes before that call never become its targets, and nothing reports the miss.

`activities/start` needs `timeoutMs` because the host has no other way to know when a run has gone quiet. Estimate it from the amount of work the run usually does. If the run never finishes inside that window, the host closes the activity with the `timeout` end state.

A stored document — what `plugin-data/read` and `plugin-data/list` return, and what the frontend `watch_*` doors deliver too — is `{ collection, key, value, revision, byteSize, writeMode, ownership, createdBy, updatedBy, createdAt, updatedAt }`. `revision` grows by one on every accepted write and restarts at 1 when a deleted key is created again. `ownership` is `"owned"` when only the member in `createdBy` may change or delete the document through interactive writers; `"shared"` documents follow the normal write rule. `writeMode` is `"versioned"` for documents a service producer writes through the versioned route, and interactive writers cannot touch those. `byteSize` is the stored value's canonical JSON size in bytes. `createdAt` and `updatedAt` are Unix epoch milliseconds.

With `plugin.data.write`, a backend run also reaches `POST /api/v1/plugin-data/write`, `/write-batch`, and `/delete`. Read their shapes off `BonoboHttpApi`; a UI token never carries the write scope.

Where a run may write depends on how it started:

- An upload-triggered run is scoped to the triggering upload:
  - `files/download-urls` accepts only `[event.source.fileNodeId]` and signs the run's original asset.
  - `files/write` is Markdown-only and writes siblings of the upload: `path` must be an absolute `.md` path whose parent folder equals `event.source.path`'s parent folder.
  - `files/touch` creates those same siblings empty, so users see where the outputs will land before the run fills them. Every path follows the `files/write` rule above, and a later `files/write` fills the node it already made.
- An invoke run (`event: "ui.invoke.requested"`, started by a frame through `client.backend.invoke`) has no source file. With `workspace.files.own-write`, its write authority is the plugin's own folder area instead: create or reuse a folder with `POST /api/v1/files/plugin-folders/ensure` (body `{ path, access?: { readOnly?: boolean, readScopeId?: string | null } }`, response `{ nodeId, path, created }`; the access fields need `workspace.files.own-access`), then write Markdown inside it with `files/write`. Every node it creates carries the plugin's ownership stamp, and a write whose existing folder chain does not carry the stamp answers `403`.
- With `workspace.files.read`, any backend run may also call `POST /api/v1/files/list` and `POST /api/v1/files/read` (the same request and response shapes the developer API uses), reading with the acting member's visibility.
- With `workspace.files.own-access`, a run may change access on its own stamped nodes through `POST /api/v1/files/plugin-access/set` (body `{ path, access: { readOnly?: boolean, readScopeId?: string | null } }` — `access` must set at least one field; response `{ nodeId }`): `readOnly: true` writes a plugin-named read-only lock members cannot remove, `readOnly: false` releases it, and `readScopeId` binds or releases the node's reader list against one of the plugin's private data scopes (the host keeps the file's readers equal to the scope members).
- `POST /api/v1/files/plugin-archive` (body `{ path }`, response `{ archivedNodes }`) archives one of the plugin's own stamped folders or files with its subtree, releasing the plugin's own lock in the same call. A sealed service grant may call it too, for paths inside its destination.
- `activities/start` is optional: a run that never calls it stays out of the workspace activity feed. After a run opts in, the host tracks the rest — the files the run touches or writes become the activity's targets, and the run's own outcome closes it.

Error statuses: `400` invalid input, `401` bad or expired run token, `403` missing scope or a write path outside the run's authority (the sibling constraint for upload runs, the stamped area for invoke runs), `404` hidden or mismatched resource (including a `fileNodeId` that is not the run's source), `409` `overwrite: "fail"` conflict, `429` run call quota or rate limit, `500` curated storage failure. An upload-triggered run succeeds only if it writes at least one Markdown output; an invoke run succeeds on a clean exit, because its result is its own response body.

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

The host loads `entry` at its immutable asset URL in an iframe with `sandbox="allow-scripts allow-same-origin allow-forms"`. Handle forms in JS (`onSubmit` + `preventDefault`); the frame's CSP carries `form-action 'none'`, so a native HTTP form submission is always blocked by the browser. The frame keeps the Convex asset origin, which is also the public API origin, so its normal JSON requests with a bearer header are same-origin and need no CORS preflight. The host app has a different origin, so the frame still cannot read the host DOM or host cookies. The asset URL keeps an empty query. Its fragment carries only the host's canonical HTTP(S) origin and a fresh per-frame nonce; fragments are not sent in the asset request, cache key, or referrer. Frame and host use one strict postMessage contract: the frame first sends the nonce-bound ready message, then receives its context, a short-lived scoped session token (`plu_...`), its plugin-session JWT (`jwt`), and the Convex deployment URL (`convexUrl`) in `bonobo:init`. Tokens and context never appear in a URL. Secret values never reach plugin frontends — `plugin.secrets.read` is backend-only.

A plugin frontend is trusted with the token and every datum its accepted permissions expose. The sandbox isolates the host DOM, cookies, and origin, but it is not a confidentiality boundary against the frame's own code: a navigation inside the frame can send data away before the host observes the next load and revokes the session. Plugin frames share the Convex asset origin, so plugin code must not use origin storage for secrets or as a boundary from another plugin. The host mounts only one plugin frame at a time; hidden file-view frames are unmounted.

| Direction    | Message                        | Fields                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frame → host | `bonobo:ready`                 | `nonce`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| frame → host | `bonobo:token-refresh-request` | `nonce`, `requestId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| host → frame | `bonobo:init`                  | `nonce`, `apiOrigin`, `convexUrl`, `token`, `tokenExpiresAt` (epoch ms), `jwt`, `jwtExpiresAt` (epoch ms; both optional, see below), `context` (union on `kind`: `"page"` carries `{ pluginName, userId, pageId, pageTitle, organizationId, workspaceId }`; `"file_view"` carries `{ pluginName, userId, fileViewId, fileViewTitle, organizationId, workspaceId, file: { fileNodeId, name, path, contentType } }`), `theme` (optional: `{ mode, tokens }`, `tokens` keyed by the app's `--color-<scale>-NN` custom property names — see `client.theme` below) |
| host → frame | `bonobo:theme`                 | `nonce`, `theme`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| host → frame | `bonobo:token`                 | `nonce`, `requestId`, `token`, `tokenExpiresAt`, `jwt`, `jwtExpiresAt` (both optional)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| host → frame | `bonobo:token-error`           | `nonce`, `requestId`, `message`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

`bonobo_connect` (from `bonobo-plugin-sdk/frontend`) implements the frame side. Before connecting, it requires exactly one canonical HTTP(S) `parentOrigin` and one UUIDv4 `nonce` in the URL fragment. It sends ready with that nonce to the exact parent origin and retries until init or document unload. The host starts minting the session while the iframe assets load, but it does not send the token until this ready message proves the current frame loaded the bridge. Every host message must come from `window.parent`, that exact origin, and the matching nonce. The host posts only to the concrete Convex asset origin. The host owns the startup deadline.

Importing the module does nothing by itself; the frame's entry code must call `bonobo_connect()` once and use the resolved client for everything after. A frame opened outside the host never gets past ready, by design. What the two fragment values are for: `parentOrigin` tells the SDK where to address `postMessage`, so it never sends with `"*"` — it is not authentication of the embedder (CSP `frame-ancestors` on the asset decides who may embed, and only the host's session mint produces a token). The nonce is a conversation id for one mount of one iframe: it proves the ready message came from a document that read this mount's fragment, it lets both sides drop late messages from an earlier mount, and because it sits in the URL a new mount always loads a fresh document. It is visible to the page and is not a secret.

Token lifetimes, so plugin code never handles refresh itself: the session token lives 30 minutes, `getToken` refreshes it through the host when it is within 60 seconds of expiry, and a `fetchJson` call that meets a 401 refreshes once and retries once. A refresh rotates the token on the same session while it lives; when the session is already gone (the device slept past its expiry), the host mints a new session for the same frame and answers the refresh with its token, so the page keeps its state and its watches. The plugin-session JWT arrives beside the token (`jwt`, `jwtExpiresAt`) and expires with it; a refresh answers with both, and the Convex client's own ask for a new JWT shortly before expiry is what triggers that refresh. The session record on the host is the kill switch: revoking it (unmount, navigation away, uninstall, upgrade) ends every live subscription at once. Secrets never reach the frame — the token has no secrets scope and the SDK has no secrets API; a frame that needs one calls its backend through `backend.invoke`, and the backend reads it with `env.BONOBO.secrets.get`.

On init, the SDK also opens the frame's own Convex client against `convexUrl` (see [Using the Convex client](#using-the-convex-client)). The SDK closes that client on `pagehide`. A frame the browser restores from its back/forward cache does not reconnect: subscriptions stay frozen until a real reload.

Do not give your frame document a `no-referrer` referrer policy (for example `<meta name="referrer" content="no-referrer">`). Under that policy the browser sends `Origin: null` on the SDK's same-origin exchange POST (the fallback for a host that sent no JWT), the server refuses it, and such a frame can never authenticate its Convex client.

### Using the Convex client

`client.convex` is the frame's own authenticated Convex client, a `ConvexReactClient` from `convex/react`, and `client.api` holds typed references to the plugin doors, generated from the app into `convex-api.d.ts` (`bonobo-plugin-sdk/convex-api`). It is one of two generated files: `http-api.d.ts` (`bonobo-plugin-sdk/http-api`) does the same for the HTTP routes. The app's own generator writes both, and the app's lint fails while either one is stale. The SDK owns the client: it opens it on init, keeps it authenticated, and closes it on `pagehide`. A plugin never builds a second one. `react` and `convex` are peer dependencies of the SDK, so every plugin declares both in its own `dependencies`. The SDK needs `convex/react` at runtime even when the plugin never imports it.

**A plugin that imports `convex/react` itself must end up with the same `convex` install as the SDK.** The SDK builds the client, and the plugin's hooks read the client that the plugin's `ConvexProvider` was handed. Two different `convex` versions in one bundle means the hooks drive a client built by another copy of the library, which type-checks and then behaves in ways nothing here promises. That is why `convex` is a peer dependency since SDK 0.15.0: the package manager resolves the SDK's `convex/react` import to the plugin's own copy, so one bundle holds one `convex`. Keep the plugin's `convex` range equal to the SDK's peer range (`^1.42.2`) and check the plugin's lockfile resolves exactly one `convex` before releasing.

The doors run as reactive queries and mutations on that client — not over the bridge, and not on the UI token. To authenticate it, the SDK uses the plugin-session JWT the host delivers with the session token (in `bonobo:init` and in every `bonobo:token`); it identifies the viewing member with plugin-scoped permissions and expires with the token. When Convex needs a fresh JWT, the SDK refreshes the session through the host and hands over the JWT that comes back. A host that sends no JWT is covered by exchanging the token at `POST <apiOrigin>/plugins-ui/session-jwt` (same-origin, so no CORS); there a `401` gets one host token refresh and one re-exchange before the client goes unauthenticated. A one-second wake poll notices a wall-clock gap of 30 seconds and calls `setAuth` again, so Convex pauses before an old session can reconnect while the host re-mints it. The Convex functions load the session on every call, so revoking it (uninstall, disable, upgrade, or a second load of the same frame) turns every live subscription into a refusal — a signed-valid JWT does not outlive its session. The UI token still never carries the plugin-data write scope; frame writes go through member-attributed `user_*` mutations instead.

Hand the client to `ConvexProvider` once, at the root:

```tsx
import { ConvexProvider } from "convex/react";

const client = await bonobo_connect();
root.render(
	<ConvexProvider client={client.convex}>
		<App client={client} />
	</ConvexProvider>,
);
```

Then read the doors with the hooks, always with a reference from `client.api`. TypeScript checks the arguments and the delivered value:

```tsx
import { usePaginatedQuery, useQuery } from "convex/react";

// A live timeline that keeps its older pages. Every loaded page stays subscribed, so an edit or
// a deletion inside an older page still reaches the screen. A page holds at most 100 documents.
const timeline = usePaginatedQuery(
	client.api.plugins_data.watch_documents_page,
	{ collection: "messages", keyPrefix: "c:general/" },
	{ initialNumItems: 100 },
);
// timeline.results, timeline.status ("LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"),
// timeline.loadMore(100)

// One capped read. `undefined` while loading, `null` when the door refused the read.
const cursors = useQuery(client.api.plugins_data.watch_documents, {
	collection: "cursors",
	keyPrefix: `me:${userId}`,
	limit: 1,
});
```

Outside React, or for a one-shot call:

```ts
// A subscription without a hook.
const scopesWatch = client.convex.watchQuery(client.api.plugins_data.watch_my_scopes, {});
const stop = scopesWatch.onUpdate(() => {
	const scopes = scopesWatch.localQueryResult(); // throws when the query failed
});

// One read, one write. A write resolves the door's own `Result`; a refused write is its `_nay`.
const roster = await client.convex.query(client.api.plugins_data.list_members, { limit: 100 });
const written = await client.convex.mutation(client.api.plugins_data.user_put_owned_document, {
	collection: "cursors",
	key: "me",
	value: { at: Date.now() },
	expectedRevision: 0,
});
```

What the doors answer, and what the client does not do for you:

- A refused read is the door's own answer: `null` from `watch_documents`, `watch_recent`, `watch_changes`, `watch_my_scopes`, `watch_scope_principals`, `resolve_member_display`, and `list_members`, and an empty final page (`{ page: [], isDone: true, continueCursor: "" }`) from `watch_documents_page`, because `usePaginatedQuery` cannot take `null`. The plugin was uninstalled or disabled, the capability is not accepted, the member lost access, or the session is gone. Render nothing for what a member cannot read: an unreadable private scope's documents simply never arrive, and a "locked" placeholder would tell the member the thing exists.
- The doors give the same refusal for a lapsed session and a revoked plugin. `client.session.expiresAt()` tells them apart: it is the last `tokenExpiresAt` the host sent. A refusal after that time means the session ran out and a reload gets a new one; a refusal before it means access is gone. `client.session.fetchJwt` is the auth callback the SDK gave the client, for tests and debugging probes.
- A transport failure rejects `query` and `mutation`, throws from `useQuery` and `usePaginatedQuery` (put an error boundary around the tree), and comes back as an `Error` value from `useQueries`. Nothing is retried for you. Map a rejected write to your own "try again" state.
- Nothing is counted. The server enforces no per-frame subscription cap, so a page that opens subscriptions in a loop is limited only by the browser. Keep the number of live subscriptions small on purpose: every one re-runs on the server when a write touches its range, and every re-run reads the session's auth docs first. The host accepts this fan-out as a known risk, bounded by the 30-minute session and by revocation.
- The identity is the plugin-session JWT, and only the plugin doors resolve it to a member. Every other function of the app sees no user behind it: a query that needs a member throws `Unauthenticated` (a few, like `users:get_anagraphic`, answer `null` instead) and a mutation that needs one returns a `_nay` `Unauthenticated`. The app's own tests pin this for `users:get_anagraphic` and `ai_chat:thread_create`. `client.api` lists everything the JWT can call as a member.
- The client closes on `pagehide`. A subscription ends with it.

The doors are the `user_*` writes, `user_manage_scope`, the `watch_*` reads, `resolve_member_display`, and `list_members`. Their argument and result types are the app's own, and the rules behind them (private scopes and their caps, owned documents, the roster capability, the 1..100 page sizes) are in each door's docblock in the app's `plugins_data` module. A user id is `GenericId<"users">` from `convex/values`. `context.userId` and every id a door returns already have that type, so they reach a door with no cast. An id you stored inside your own document value comes back as a plain string when you parse the value, so brand it there once, at the parse step, not at each call. A write's `_nay.message` union lists the exact refusal texts of the app version the SDK was generated from. In the app, `pnpm run generate:plugin-sdk-types` rewrites the file and the lint fails while it is stale. The check reads the working tree, so commit the regenerated file together with the door change; a release cut from a green lint then ships the types of the app at that commit.

### Theme

The host's theme reaches the frame as `{ mode: "light" | "dark", tokens }`, once inside `bonobo:init` and again on every `bonobo:theme`. A plugin frame is a separate document and inherits none of the host's custom properties, so the host resolves its numbered colour scales and sends every value under its real name, `--` prefix included: `--color-base-1-01` … `--color-base-1-12`, and the same for `base-2`, `base-alt-1`, `base-alt-2`, `fg`, `accent`, `accent-alt`, `green`, and `red` (`accent` and `accent-alt` have 10 steps, the rest 12). **The SDK applies it for you**: each token is written onto `document.documentElement.style`, and the root element gets the same `light` or `dark` class the app puts on its own root. So a stylesheet needs no plugin code at all — use the app's variables and its theme class exactly as the app does, and keep a fallback for a host that sends no theme:

```css
.panel {
  background: var(--color-base-1-03, #16161a);
  color: var(--color-fg-12, #ececef);

  .dark & {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  }
}
```

`client.theme.current()` returns the theme the host last sent, or `null` when it sent none (then nothing was written and the page keeps its own colours). `client.theme.subscribe(onChange)` calls `onChange` on every later theme, after the SDK has applied it — the member switching the app's theme — and returns the unsubscribe function. It never fires for the current theme, so read `current()` first. Both exist for what CSS cannot do, such as a canvas colour or an image treatment chosen by `mode`.

### UI token API surface

With the `workspace.files.read` capability the UI token may call:

| Route                              | Scope            |
| ---------------------------------- | ---------------- |
| `POST /api/v1/files/list`          | `files:list`     |
| `POST /api/v1/files/read`          | `files:read`     |
| `POST /api/v1/files/download-urls` | `files:download` |

UI tokens are rejected on `/api/v1/files/write`.

A UI token also reaches `POST /api/v1/plugin-data/read` and `/list` (with `plugin.data.read`), `POST /api/v1/plugin-backend/invoke` (with `plugin.backend.invoke`), and the same-origin `POST /plugins-ui/session-jwt` the SDK uses itself. Those seven routes are the whole UI surface.

`client.fetchJson(path, init)` types `path` and `init.body` from the generated `BonoboHttpApi` table, so a path the host does not serve and a body field the route does not accept are compile errors:

```ts
// The body is checked against the app's own route schema.
const page = await client.fetchJson("/api/v1/files/list", { body: { limit: 100, kind: "file" } });
```

The table holds every route a plugin's frame or backend run may reach. It does not hold the service-upload routes above, which only a sealed `psg_` grant may call. Because it holds the backend-run routes too, typing accepts a few paths a UI token cannot use: `/api/v1/files/write` compiles and still answers `403`. The seven routes above are the ones that work.

`client.fetchJson(...)` answers `Promise<unknown>`. The value comes from outside the page, so check the shape before reading fields off it. The pagination rule below is the reason: a listing page may come back short or even empty while `isDone` is still `false`.

`files/download-urls` accepts at most 100 file IDs in a 32 KB request, processes the first 20, and returns `{ items, errors, truncated }`.
Each of the first 20 requested files consumes one call from the route's principal rate-limit
bucket. One inaccessible file appears in `errors` without discarding the other successful URLs.
Duplicate file IDs are rejected with `400` before they consume route capacity or start file work.

Pagination of `/api/v1/files/list` (`{ items, cursor, isDone }`): with `contentTypePrefixes`, one request uses one bounded query. `scanLimit` sets its source-doc budget; the server defaults and caps it at 10,000 docs. The query does not set a byte-read cap. A page may come back short or even empty while `isDone` is still `false` — keep passing `cursor` until `isDone` is `true` or you have enough items. Scan with `limit: 100`, `scanLimit: 10000`, and `kind: "file"`; bound the requests advanced per user action, buffer overflow items for the next action, and retry a `429` on the same cursor.

### Backend invoke (`client.backend.invoke`)

With the `plugin.backend.invoke` capability, a frame may run the plugin's backend on demand. The manifest must declare the endpoints (at most 8; each `path` starts with `/`, is at most 256 printable ASCII characters, and may not use the reserved `/__bonobo_senate` prefix):

```jsonc
"backend": {
	"endpoints": [
		{ "id": "refresh", "path": "/refresh", "serialization": "installation" }
	]
}
```

`client.backend.invoke({ endpoint, input?, serializationKey? })` names the endpoint by its `id`, POSTs `/api/v1/plugin-backend/invoke` on the UI token, and resolves — never rejects — with `BonoboBackendInvokeResult`: `{ _yay: { runId, pluginStatus, output, outputTruncated } }` or `{ _nay: { name, message, retryAfterMs? } }`. Since 0.16.0 the `_yay` branch is the route's own `200` body out of `BonoboHttpApi`, not a copy of it kept here. The backend receives a `BonoboInvokeRequestedEvent` at the endpoint's declared path — the normal run envelope plus `invoke: { endpointId, serializationKey, input }` — and answers with its own response body: `pluginStatus` is that response's status, and a non-2xx `pluginStatus` still resolves `_yay`, because the plugin did answer. The whole invoke request body may be at most 32 KiB.

Three rules for a plugin that uses it:

- **Identity.** The backend must read who is acting from the envelope's `actorUserId` only — never from `input`, which any page code can fill with anything.
- **Idempotency (the honest limit).** The host dedupes nothing: a retried call runs the backend again. The store and the file system are two systems with one transaction each, so a backend that writes both can crash in between and leave one of them written. Put a client request id inside `input` and dedupe in your own store writes, so a retry after an `unavailable` answer cannot apply the same work twice.
- **Serialization.** An endpoint with `serialization: "installation"` runs one invoke at a time for the whole installation; `"caller-key"` serializes per `serializationKey` (required then, at most 128 characters). A call that finds one already running resolves `_nay` with `name: "busy"` and `retryAfterMs` — wait and retry.

`_nay.name` vocabulary: `busy` (a serialization conflict or the rate limit, with `retryAfterMs`), `denied` (the capability is not accepted or the frame's access is gone), `session_expired` (reload the frame), `invalid` (the request was refused — malformed, or too large for this plugin's configuration), and `unavailable` (a transport failure or a failed backend run — the outcome is unknown, so only retry work that is safe to repeat).

### Frontend page example

```js
import { bonobo_connect } from "bonobo-plugin-sdk/frontend";

const client = await bonobo_connect();
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
