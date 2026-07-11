# Bonobo Plugin SDK

Types-only SDK for Bonobo workspace plugins, built on `@cloudflare/workers-types`. It ships a single hand-written `index.d.ts` and no runtime JavaScript — plugin workers are plain Cloudflare-style JS typed via JSDoc.

## Capabilities

A plugin manifest declares at most two capabilities (`BonoboCapability`), which a workspace consents to on install:

- `plugin.secrets.read` — `env.BONOBO.secrets.get(name)` resolves the publisher secret (or the workspace's shadowing installation secret) or `null`.
- `outbound.fetch` — native `fetch` to third-party HTTPS origins listed in the manifest's outbound origins.

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
