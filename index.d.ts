import type { ExportedHandler } from "@cloudflare/workers-types";

/** Cloudflare workers types re-exported so plugin repos only need this package for worker typing. */
export type { ExportedHandler, ExecutionContext, Request, Response } from "@cloudflare/workers-types";

/** The two capabilities a plugin manifest may declare and a workspace consents to on install. */
export type BonoboCapability = "plugin.secrets.read" | "outbound.fetch";

/**
 * `env.BONOBO.secrets` — requires the `plugin.secrets.read` capability.
 * `get` resolves the secret value (a same-name installation secret shadows the publisher secret),
 * or `null` when the secret is not configured.
 */
export interface BonoboSecrets {
	get(name: string): Promise<string | null>;
}

/**
 * `env.BONOBO.host` — always present, no capability required. The public host APIs are plain
 * `fetch` calls against `apiOrigin` and must send `Authorization: Bearer <host.token>`.
 */
export interface BonoboHost {
	apiOrigin: string;
	token: string;
}

/** The frozen `env.BONOBO` binding every plugin worker receives. */
export interface BonoboBinding {
	secrets: BonoboSecrets;
	host: BonoboHost;
}

/** The plugin worker `env` — `BONOBO` is the only Bonobo-provided binding. */
export interface BonoboEnv {
	BONOBO: BonoboBinding;
}

/** The uploaded file that triggered the run (`source` of {@link BonoboUploadCompletedEvent}). */
export interface BonoboUploadSource {
	fileNodeId: string;
	assetId: string;
	name: string;
	contentType: string | null;
	size: number;
}

/**
 * JSON body of the `request` the worker's `fetch(request, env, ctx)` receives for an
 * upload-triggered run.
 */
export interface BonoboUploadCompletedEvent {
	pluginRunId: string;
	event: "files.upload.completed";
	eventId: string;
	organizationId: string;
	workspaceId: string;
	actorUserId: string;
	source: BonoboUploadSource;
}

/**
 * Request body for `POST {host.apiOrigin}/api/plugins/v1/source-temporary-url`
 * (`Authorization: Bearer host.token`). `expiresInSeconds` is clamped to 1..900.
 */
export interface BonoboSourceTemporaryUrlRequest {
	pluginRunId: string;
	expiresInSeconds?: number;
}

/**
 * Response body of `POST {host.apiOrigin}/api/plugins/v1/source-temporary-url` — a presigned
 * download URL for the triggering upload. `expiresAt` is Unix epoch milliseconds.
 */
export interface BonoboSourceTemporaryUrlResponse {
	url: string;
	expiresAt: number;
}

/**
 * Request body for `POST {host.apiOrigin}/api/plugins/v1/write-markdown`
 * (`Authorization: Bearer host.token`). Writes a Markdown output file next to the source upload;
 * responds `{ ok: true }`. `overwrite` controls what happens when `path` already exists.
 */
export interface BonoboWriteMarkdownRequest {
	pluginRunId: string;
	markdown: string;
	path?: string;
	overwrite?: "replace" | "fail";
}

/** Type of a plugin worker's `export default` — `fetch(request, env, ctx)` with a typed `env.BONOBO`. */
export type BonoboPluginHandler = ExportedHandler<BonoboEnv>;
