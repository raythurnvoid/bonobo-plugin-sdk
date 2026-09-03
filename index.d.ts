import type { ExportedHandler } from "@cloudflare/workers-types";

/**
 * Cloudflare workers types re-exported so plugin repos only need this package for worker typing.
 */
export type { ExportedHandler, ExecutionContext, Request, Response } from "@cloudflare/workers-types";

/**
 * The capabilities a plugin manifest may declare and a workspace consents to on install.
 *
 * Capabilities may authorize more than one caller. Each entry names all current callers:
 *
 * - `plugin.secrets.read` — the backend run may call `env.BONOBO.secrets.get(name)`.
 * - `outbound.fetch` — the backend run may `fetch` the manifest's `outboundOrigins`.
 * - `workspace.files.read` — the plugin's UI pages and file views may read workspace files, and so
 *   may backend runs. It puts the `files:list`, `files:read`, and `files:download` scopes on the
 *   frame's UI token and `files:list` + `files:read` on a backend run's token. A run always reads
 *   with the acting member's visibility, so it can never see a restricted folder that member
 *   cannot open.
 * - `workspace.files.write` — authorizes `files:write` on a sealed processing-phase service grant,
 *   capped by an exact destination path prefix. It never reaches the frame. The interactive
 *   exchange never mints that scope; the service gets it through the seal-processing route. A
 *   sealed grant may use the `/api/v1/files/service-uploads/*` routes, write Markdown inside its
 *   seal through `/api/v1/files/write`, and archive a file it wrote through
 *   `/api/v1/files/plugin-archive`.
 * - `workspace.files.create-read-only` — lets the service request a direct read-only lock when it
 *   creates a file. Declaring it also requires `workspace.files.write`.
 * - `workspace.files.own-write` — backend invoke runs may create, update, and archive files inside
 *   folders the plugin created and stamped as its own. It never reaches files a member or another
 *   plugin owns. Declaring it also requires `workspace.files.write`.
 * - `workspace.files.own-access` — backend invoke runs may lock the plugin's own files read-only
 *   and choose which members can read them. Declaring it also requires `workspace.files.own-write`.
 * - `plugin.data.read` — backend runs, UI pages and file views, and eligible Council service grants
 *   may read the plugin's own document store.
 * - `plugin.data.write` — backend runs and eligible Council service grants may write the plugin's own
 *   document store. A frame's UI token never receives the write scope, whatever the installation
 *   accepted. Declaring it also requires `plugin.data.read`.
 * - `plugin.data.user-write` — the plugin's UI pages and file views may create, change, and delete
 *   documents in that store as the acting member. The write never rides the frame's UI token: it
 *   runs through the app's own member-attributed mutations. Declaring it also requires
 *   `plugin.data.read`.
 * - `plugin.backend.invoke` — the plugin's UI pages and file views may start a backend run on one
 *   of the manifest's declared `backend.endpoints` through the host invoke route. Declaring it
 *   requires a plugin backend with at least one declared endpoint.
 * - `plugin.service.connect` — lets the plugin's UI token from a page or a file view participate
 *   in the service-grant exchange, but grants no API scope itself. The exchange reads only the
 *   session's installation and member, so both frame kinds work the same. The outside service must
 *   also authenticate with the exchange secret from the plugin's publisher-managed service
 *   registration; the registration's scopes decide what the grant carries. Declaring it requires
 *   `plugin.data.read` or `workspace.files.write` as well, because a grant that carries no scope
 *   buys the service nothing.
 * - `ui.outbound.fetch` — the plugin's UI pages and file views, running in the member's browser, may
 *   call the manifest's `uiOutboundOrigins`. It is enforced as `connect-src` in the frame's CSP. It
 *   and `uiOutboundOrigins` require each other: neither may be declared alone.
 * - `workspace.members.read` — the plugin's UI pages and file views may list every member of the
 *   workspace, as user ids and display names. Email is never returned. Without it a frame can still
 *   resolve names for ids it already holds, which enumerates nobody. Every member reads the roster
 *   under one rule, including a member who signed in anonymously.
 */
export type BonoboCapability =
	| "plugin.secrets.read"
	| "outbound.fetch"
	| "workspace.files.read"
	| "workspace.files.write"
	| "workspace.files.create-read-only"
	| "workspace.files.own-write"
	| "workspace.files.own-access"
	| "plugin.data.read"
	| "plugin.data.write"
	| "plugin.data.user-write"
	| "plugin.backend.invoke"
	| "plugin.service.connect"
	| "ui.outbound.fetch"
	| "workspace.members.read";

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
 *
 * Their request and response shapes are generated from the app into `bonobo-plugin-sdk/http-api`.
 * Type a call with `BonoboHttpApi["/api/v1/files/write"]["POST"]["body"]` and read a `200` back
 * with `["POST"]["response"][200]["body"]`. Until 0.16.0 this package carried a second
 * hand-written copy of those shapes. The README's "Public host APIs" table now carries the rules
 * that lived in their doc blocks.
 */
export interface BonoboHost {
	apiOrigin: string;
	token: string;
}

/**
 * The frozen `env.BONOBO` binding every plugin worker receives.
 */
export interface BonoboBinding {
	secrets: BonoboSecrets;
	host: BonoboHost;
}

/**
 * The plugin worker `env` — `BONOBO` is the only Bonobo-provided binding.
 */
export interface BonoboEnv {
	BONOBO: BonoboBinding;
}

/**
 * The uploaded file that triggered the run (`source` of {@link BonoboUploadCompletedEvent}).
 */
export interface BonoboUploadSource {
	fileNodeId: string;
	assetId: string;
	name: string;
	/**
	 * Absolute workspace path of the upload — build sibling output paths from it.
	 */
	path: string;
	contentType: string | null;
	size: number;
}

/**
 * A JSON value parsed from the installation's plugin-owned YAML configuration.
 */
export type BonoboConfigurationValue =
	| null
	| boolean
	| number
	| string
	| BonoboConfigurationValue[]
	| { [key: string]: BonoboConfigurationValue };

/**
 * JSON body of the `request` the worker's `fetch(request, env, ctx)` receives for a file run.
 * An upload-triggered run sets `event` to `"files.upload.completed"`. A manual or backfill
 * re-run delivers the same `source` with `"files.run.requested"`.
 */
export interface BonoboUploadCompletedEvent {
	pluginRunId: string;
	event: "files.upload.completed" | "files.run.requested";
	eventId: string;
	organizationId: string;
	workspaceId: string;
	actorUserId: string;
	/**
	 * Parsed installation settings, or null when the plugin does not declare configuration.
	 */
	configuration: BonoboConfigurationValue;
	source: BonoboUploadSource;
}

/**
 * The invoke payload of a {@link BonoboInvokeRequestedEvent}. `input` is whatever the page sent —
 * it is UNTRUSTED page data: any code running in the frame can fill it with anything, so never
 * read an acting identity from it. The member behind the run is the envelope's `actorUserId`,
 * which the host verified from the frame's session. `serializationKey` echoes the page's key for
 * a `"caller-key"` endpoint and is `null` otherwise.
 */
export interface BonoboInvokeRequestedEventInvoke {
	endpointId: string;
	serializationKey: string | null;
	input: unknown;
}

/**
 * JSON body of the `request` the worker's `fetch(request, env, ctx)` receives for an invoke run:
 * a page or file view called the host's `/api/v1/plugin-backend/invoke` route (through
 * `client.backend.invoke` in the frontend SDK) and the host runs the backend synchronously. The
 * request URL is `https://plugin.local<endpoint.path>` for the declared endpoint, so `fetch` can
 * route on `request.url` like a small router; host events keep the reserved
 * `/__bonobo_senate/run` path, which a manifest endpoint can never use. `source` is always null —
 * there is no triggering file, so the sibling-write rule does not apply; with
 * `workspace.files.own-write` the run writes inside the folders the plugin owns instead.
 *
 * The response the plugin returns (status and body text) is relayed to the page as the invoke
 * result.
 */
export interface BonoboInvokeRequestedEvent {
	pluginRunId: string;
	event: "ui.invoke.requested";
	eventId: string;
	organizationId: string;
	workspaceId: string;
	/**
	 * The member whose click started this run, host-verified from the frame's session. Read who is
	 * acting from THIS field only, never from `invoke.input`.
	 */
	actorUserId: string;
	/**
	 * Parsed installation settings, or null when the plugin does not declare configuration.
	 */
	configuration: BonoboConfigurationValue;
	source: null;
	invoke: BonoboInvokeRequestedEventInvoke;
}

/**
 * Type of a plugin worker's `export default` — `fetch(request, env, ctx)` with a typed `env.BONOBO`.
 */
export type BonoboPluginHandler = ExportedHandler<BonoboEnv>;
