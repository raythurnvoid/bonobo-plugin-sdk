# Bonobo Plugin SDK

Types-only SDK for Bonobo workspace plugins, built on `@cloudflare/workers-types`. It ships a single hand-written `index.d.ts` and no runtime JavaScript — plugin workers are plain Cloudflare-style JS typed via JSDoc.

## Capabilities

A plugin manifest declares at most two capabilities (`BonoboCapability`), which a workspace consents to on install:

- `plugin.secrets.read` — `env.BONOBO.secrets.get(name)` resolves the publisher secret (or the workspace's shadowing installation secret) or `null`.
- `outbound.fetch` — native `fetch` to third-party HTTPS origins listed in the manifest's outbound origins.

The host APIs below need no capability: requests to `env.BONOBO.host.apiOrigin` are always allowed.

## Public host APIs

Both are plain `fetch` calls against `env.BONOBO.host.apiOrigin` with `Authorization: Bearer <env.BONOBO.host.token>`:

| Route | Body | Response |
| --- | --- | --- |
| `POST /api/plugins/v1/source-temporary-url` | `BonoboSourceTemporaryUrlRequest` — `{ pluginRunId, expiresInSeconds? }` (1..900) | `BonoboSourceTemporaryUrlResponse` — `{ url, expiresAt }` (`expiresAt` in epoch ms) |
| `POST /api/plugins/v1/write-markdown` | `BonoboWriteMarkdownRequest` — `{ pluginRunId, markdown, path?, overwrite?: "replace" \| "fail" }` | `{ ok: true }` |

Errors respond `400`/`401` with `{ message }`. A run succeeds only if it writes at least one markdown output.

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
		const urlResponse = await fetch(`${env.BONOBO.host.apiOrigin}/api/plugins/v1/source-temporary-url`, {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({ pluginRunId: event.pluginRunId, expiresInSeconds: 900 }),
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

		// Host API: write the run's markdown output.
		await fetch(`${env.BONOBO.host.apiOrigin}/api/plugins/v1/write-markdown`, {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({ pluginRunId: event.pluginRunId, markdown: completion.choices[0].message.content }),
		});

		return Response.json({ ok: true });
	},
};
```
