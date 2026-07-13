import type { ExportedHandler } from "@cloudflare/workers-types";

/** Cloudflare workers types re-exported so plugin repos only need this package for worker typing. */
export type { ExportedHandler, ExecutionContext, Request, Response } from "@cloudflare/workers-types";

/**
 * The capabilities a plugin manifest may declare and a workspace consents to on install.
 * `workspace.files.read` gives the plugin's UI pages read access to workspace files — it puts
 * the `files:list`, `files:read`, and `files:download` scopes on the page's UI token. It never
 * applies to backend runs.
 */
export type BonoboCapability = "plugin.secrets.read" | "outbound.fetch" | "workspace.files.read";

/**
 * Optional `navItem` of a manifest `pages[]` entry ({@link BonoboManifestPage}). Declaring it is
 * the explicit opt-in that adds a main-sidebar nav item in the host app. `label` is 1–40
 * characters; `icon` is an optional lucide kebab-case icon name matching `/^[a-z0-9-]{1,64}$/`.
 * The host currently renders only `"images"`, `"image"`, `"film"`, and `"gallery-vertical-end"`.
 * Any other name publishes fine but falls back to a generic puzzle icon, so the supported set
 * can grow without a manifest change.
 */
export interface BonoboManifestPageNavItem {
	label: string;
	icon?: string;
}

/**
 * A manifest `pages[]` entry: a plugin UI page the host app loads in a sandboxed iframe (see
 * the `bonobo-plugin-sdk/frontend` export). `id` matches `/^[a-z0-9][a-z0-9-]{0,63}$/` and is
 * unique per manifest, `title` is 1–80 characters, and `entry` must be a manifest `files[]`
 * entry with contentType `"text/html"`.
 */
export interface BonoboManifestPage {
	id: string;
	title: string;
	entry: string;
	navItem?: BonoboManifestPageNavItem;
}

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
