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

| Route | Body | Response |
| --- | --- | --- |
| `POST /api/v1/files/download-url` | `BonoboFilesDownloadUrlRequest` — `{ fileNodeId, expiresInSeconds? }` (1–900; defaults to 900; values above 900 are rejected with `400`, not clamped; the granted TTL is then clamped to the remaining run-token lifetime) | `BonoboFilesDownloadUrlResponse` — `{ fileNodeId, url, expiresAt }` (`expiresAt` in epoch ms) |
| `POST /api/v1/files/write` | `BonoboFilesWriteRequest` — `{ path, content, overwrite?: "replace" \| "fail" }` (`overwrite` defaults to `"replace"`) | `BonoboFilesWriteResponse` — `{ path, nodeId, contentType }` |

Plugin authority is scoped to the triggering upload:

- `files/download-url` accepts only the run's `event.source.fileNodeId` and signs the run's original asset.
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
		const urlResponse = await fetch(`${env.BONOBO.host.apiOrigin}/api/v1/files/download-url`, {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({ fileNodeId: event.source.fileNodeId, expiresInSeconds: 900 }),
		});
		const { url } = await urlResponse.json();

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
- `navItem` (optional) — its presence contributes a main-sidebar nav item in the host app: `label` is 1–40 characters, `icon` an optional lucide kebab-case name matching `/^[a-z0-9-]{1,64}$/`.

### Sandbox and token model

The host loads `entry` into an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, so the page runs with an opaque origin, and appends `?parentOrigin=<encoded parent app origin>&pageId=<page id>` to the iframe URL. Page and host talk over postMessage (protocol v1): the page receives a short-lived scoped bearer token (`plu_...`) via postMessage — never via URL — and calls the public `/api/v1/*` API on `apiOrigin` directly with `Authorization: Bearer <token>`. Secret values never reach plugin frontends — `plugin.secrets.read` is backend-only.

| Direction | Message | Fields |
| --- | --- | --- |
| page → host | `bonobo:ready` | `protocolVersion: 1` |
| page → host | `bonobo:token-refresh-request` | `requestId` |
| host → page | `bonobo:init` | `protocolVersion: 1`, `apiOrigin`, `token`, `tokenExpiresAt` (epoch ms), `context: { pluginName, pageId, pageTitle, organizationId, workspaceId }` |
| host → page | `bonobo:token` | `requestId`, `token`, `tokenExpiresAt` |
| host → page | `bonobo:token-error` | `requestId`, `message` |

`bonobo_ui_connect` (from `bonobo-plugin-sdk/frontend`) implements the page side, including the security rules: it accepts incoming messages only when `event.origin === parentOrigin && event.source === window.parent`, posts to `window.parent` with `targetOrigin: parentOrigin` exactly, and silently ignores everything else.

### UI token API surface

With the `workspace.files.read` capability the UI token may call:

| Route | Scope |
| --- | --- |
| `POST /api/v1/files/list` | `files:list` |
| `POST /api/v1/files/read` | `files:read` |
| `POST /api/v1/files/download-url` | `files:download` |

UI tokens are rejected on `/api/v1/files/write`.

Pagination of `/api/v1/files/list` (`{ items, cursor, isDone }`): with `contentTypePrefixes` the server post-filters each page after pagination, so a page may come back short or even empty while `isDone` is still `false` — keep passing `cursor` until `isDone` is `true` or you have enough items.

### Frontend page example

```js
import { bonobo_ui_connect } from "bonobo-plugin-sdk/frontend";

const client = await bonobo_ui_connect();
document.title = client.context.pageTitle;

// files:list — contentTypePrefixes is post-filtered per page, so a short or empty page
// does not mean the listing is done; stop on isDone or once there is enough.
let cursor = null;
const images = [];
while (images.length < 48) {
	const page = await client.fetchJson("/api/v1/files/list", {
		body: { path: "/", recursive: true, contentTypePrefixes: ["image/"], cursor },
	});
	images.push(...page.items);
	if (page.isDone) break;
	cursor = page.cursor;
}
```
