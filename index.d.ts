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
	/** Absolute workspace path of the upload — build sibling output paths from it. */
	path: string;
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
 * Request body for `POST {host.apiOrigin}/api/v1/files/download-url`
 * (`Authorization: Bearer host.token`). Plugin runs may request only the triggering upload's
 * `source.fileNodeId`; anything else responds `404`. `expiresInSeconds` accepts 1–900 and
 * defaults to 900; values above 900 are rejected with `400`, not clamped. The granted TTL is
 * then clamped to the remaining run-token lifetime.
 */
export interface BonoboFilesDownloadUrlRequest {
	fileNodeId: string;
	expiresInSeconds?: number;
}

/**
 * Response body of `POST {host.apiOrigin}/api/v1/files/download-url` — a presigned download URL
 * for the requested file. `expiresAt` is Unix epoch milliseconds.
 */
export interface BonoboFilesDownloadUrlResponse {
	fileNodeId: string;
	url: string;
	expiresAt: number;
}

/**
 * Request body for `POST {host.apiOrigin}/api/v1/files/write`
 * (`Authorization: Bearer host.token`). V1 writes Markdown only, and plugin runs may write only
 * siblings of the triggering upload: `path` must be an absolute `.md` path whose parent folder
 * equals `source.path`'s parent folder — any other folder responds `403`. `overwrite` defaults
 * to `"replace"`; `"fail"` responds `409` when `path` already exists.
 */
export interface BonoboFilesWriteRequest {
	path: string;
	content: string;
	overwrite?: "replace" | "fail";
}

/** Response body of `POST {host.apiOrigin}/api/v1/files/write` — the created Markdown node. */
export interface BonoboFilesWriteResponse {
	path: string;
	nodeId: string;
	contentType: string;
}

/** Type of a plugin worker's `export default` — `fetch(request, env, ctx)` with a typed `env.BONOBO`. */
export type BonoboPluginHandler = ExportedHandler<BonoboEnv>;
