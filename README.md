# Bonobo Plugin SDK

SDK for Bonobo workspace plugins. The root export is types-only (a single hand-written `index.d.ts` built on `@cloudflare/workers-types`) — plugin workers are plain Cloudflare-style JS typed via JSDoc. The `bonobo-plugin-sdk/frontend` export adds a small hand-written browser ESM runtime for plugin UI pages (see [Frontend pages](#frontend-pages)).

## Capabilities

A plugin manifest declares at most three capabilities (`BonoboCapability`), which a workspace consents to on install:

- `plugin.secrets.read` — `env.BONOBO.secrets.get(name)` resolves the publisher secret (or the workspace's shadowing installation secret) or `null`.
- `outbound.fetch` — native `fetch` to third-party HTTPS origins listed in the manifest's outbound origins.
- `workspace.files.read` — grants plugin UI pages read access to workspace files: the page's UI token carries the `files:list`, `files:read`, and `files:download` scopes. Frontend-only; it never applies to backend runs.

The host APIs below need no capability: requests to `env.BONOBO.host.apiOrigin` are always allowed.

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

### Sandbox and token model

The host loads `entry` at its immutable asset URL in an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, so the page runs with an opaque origin. The URL has no bridge, context, request, or token query parameters. Page and host use one strict postMessage contract: the page first sends a non-sensitive ready message, then receives the host origin, a per-frame nonce, page context, and a short-lived scoped bearer token (`plu_...`) in `bonobo:init`. The token never appears in a URL. Secret values never reach plugin frontends — `plugin.secrets.read` is backend-only.

A plugin frontend is trusted with the token and every datum its accepted permissions expose. The sandbox isolates the host DOM, cookies, and origin, but it is not a confidentiality boundary against the page code itself: page navigation can send data away before the host observes the next load and revokes the session.

| Direction   | Message                        | Fields                                                                                                                                      |
| ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| page → host | `bonobo:ready`                 | none                                                                                                                                        |
| page → host | `bonobo:token-refresh-request` | `bridgeNonce`, `requestId`                                                                                                                  |
| host → page | `bonobo:init`                  | `bridgeNonce`, `apiOrigin`, `token`, `tokenExpiresAt` (epoch ms), `context: { pluginName, pageId, pageTitle, organizationId, workspaceId }` |
| host → page | `bonobo:token`                 | `bridgeNonce`, `requestId`, `token`, `tokenExpiresAt`                                                                                       |
| host → page | `bonobo:token-error`           | `bridgeNonce`, `requestId`, `message`                                                                                                       |

`bonobo_ui_connect` (from `bonobo-plugin-sdk/frontend`) implements the page side. Ready contains no secret, so it is posted with `targetOrigin: "*"` until init arrives. The first init must come from `window.parent`; the SDK records that message's exact origin and nonce, pins both for refresh traffic, and retries ready until init or document unload. The host owns the startup deadline.

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

Pagination of `/api/v1/files/list` (`{ items, cursor, isDone }`): with `contentTypePrefixes` the server post-filters each page after pagination, so a page may come back short or even empty while `isDone` is still `false` — keep passing `cursor` until `isDone` is `true` or you have enough items. Scan with `limit: 100` and `kind: "file"`, bound the pages advanced per user action, buffer overflow items for the next action, and retry a `429` on the same cursor.

### Frontend page example

```js
import { bonobo_ui_connect } from "bonobo-plugin-sdk/frontend";

const client = await bonobo_ui_connect();
document.title = client.context.pageTitle;

// files:list — contentTypePrefixes is post-filtered per page, so a short or even empty page
// does not mean the listing is done. Scan wide (limit 100, kind "file"), cap how many source
// pages one user action advances, and keep the cursor so the next action resumes; anything
// fetched beyond what is shown stays buffered for that next action.
let cursor = null;
let isDone = false;
const images = [];
for (let pages = 0; images.length < 48 && !isDone && pages < 30; pages += 1) {
	let page;
	for (let attempt = 0; ; attempt += 1) {
		try {
			page = await client.fetchJson("/api/v1/files/list", {
				body: { path: "/", recursive: true, kind: "file", limit: 100, contentTypePrefixes: ["image/"], cursor },
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
