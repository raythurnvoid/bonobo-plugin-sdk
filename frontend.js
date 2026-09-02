/**
 * Bonobo plugin frontend SDK — hand-written browser ESM, no build step.
 *
 * Runs inside the host app's sandboxed plugin iframe for plugin pages and plugin file views alike.
 * The comments below say "page" for both kinds, the way the host app's own notes do. Any text a
 * MEMBER can end up reading must not: it has to say "plugin frame", because a member sitting in a
 * file view is not on a page and never read these notes. That covers every `new Error(...)` the SDK
 * rejects with, and every `_nay.message` it resolves — plugin code renders those verbatim.
 *
 * The host handshake is a strict postMessage contract: the page announces `bonobo:ready`, the host
 * answers `bonobo:init` with a short-lived scoped session token (`plu_...`), the page context, and
 * the Convex deployment URL. From then on the page acts on its own:
 *
 * - Public `/api/v1/*` calls go straight to the iframe's own origin with
 *   `Authorization: Bearer <token>`.
 * - Plugin data runs on the page's OWN Convex client, a `ConvexReactClient` the page uses with the
 *   `convex/react` hooks and the typed door references in `api`. The client authenticates with
 *   the plugin-session JWT the host delivers beside the session token, in `bonobo:init` and in
 *   every `bonobo:token`. A host that sends no JWT is covered by the same-origin
 *   `/plugins-ui/session-jwt` exchange. The host window is not part of that data path; it only
 *   answers session-token refreshes over the bridge.
 */

import { ConvexReactClient } from "convex/react";
import { anyApi } from "convex/server";

/**
 * The plugin doors with the types the app generated into `convex-api.d.ts`. `anyApi` builds any
 * reference at runtime, so this cast is the one place the SDK trusts that the generated file
 * describes the deployment the frame talks to.
 *
 * @type {import("bonobo-plugin-sdk/convex-api").BonoboConvexApi}
 */
const bonobo_convex_api = /** @type {any} */ (anyApi);

/**
 * `getToken` refreshes when the token is expired or expires within this margin. The Convex auth
 * callback treats the stored JWT the same way. The Convex client itself asks for a new JWT 10
 * seconds before it expires, which is inside this margin, so that ask always ends in a host refresh.
 */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const READY_RETRY_MS = 500;
const REFRESH_DEADLINE_MS = 10_000;
// Convex pauses its socket while setAuth fetches. Run this check before its longer-lived timers so
// a tab that wakes after a long clock gap cannot reconnect with the dead session first.
const AUTH_WAKE_POLL_MS = 1_000;
const AUTH_WAKE_GAP_MS = 30_000;
const NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reads a host theme off a bridge message.
 *
 * The host resolves its colour scales and sends the values under their custom property names,
 * because a plugin page is a cross-origin document and inherits none of the host's custom
 * properties. This comes over postMessage, so every field is checked before the page can see it.
 *
 * @param {unknown} value
 * @returns {import("bonobo-plugin-sdk/frontend").BonoboUiTheme | null}
 */
function read_theme(value) {
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const candidate = /** @type {{ mode?: unknown, tokens?: unknown }} */ (value);
	if (candidate.mode !== "light" && candidate.mode !== "dark") {
		return null;
	}
	if (typeof candidate.tokens !== "object" || candidate.tokens === null) {
		return null;
	}
	/** @type {Record<string, string>} */
	const tokens = {};
	for (const [name, tokenValue] of Object.entries(candidate.tokens)) {
		if (typeof tokenValue !== "string") {
			return null;
		}
		tokens[name] = tokenValue;
	}

	return /** @type {import("bonobo-plugin-sdk/frontend").BonoboUiTheme} */ ({ mode: candidate.mode, tokens });
}

/**
 * Paints a host theme onto this document.
 *
 * The frame is a cross-origin document, so the host's stylesheet never reaches it. The SDK writes
 * each scale value onto the root element under the app's own custom property name, and puts the
 * app's `light` / `dark` class on the root too. A plugin stylesheet can then use
 * `var(--color-base-1-03)` and `.dark &` exactly as the app does, and no plugin has to copy this loop.
 *
 * @param {import("bonobo-plugin-sdk/frontend").BonoboUiTheme} theme
 */
function apply_theme(theme) {
	const root = document.documentElement;
	for (const [name, value] of Object.entries(theme.tokens)) {
		root.style.setProperty(name, value);
	}
	root.classList.toggle("light", theme.mode === "light");
	root.classList.toggle("dark", theme.mode === "dark");
}

/**
 * Reads the invoke route's success body before plugin code can use it. The route is an outside
 * boundary; `undefined` means the shape was not the contract, which the caller reports as
 * unavailable rather than handing the page a half-checked object.
 *
 * @param {unknown} value
 * @returns {{ runId: string, pluginStatus: number, output: string, outputTruncated: boolean } | undefined}
 */
function read_backend_invoke_success(value) {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	const body = /** @type {Record<string, unknown>} */ (value);
	if (
		typeof body.runId !== "string" ||
		typeof body.pluginStatus !== "number" ||
		typeof body.output !== "string" ||
		typeof body.outputTruncated !== "boolean"
	) {
		return undefined;
	}
	return { runId: body.runId, pluginStatus: body.pluginStatus, output: body.output, outputTruncated: body.outputTruncated };
}

/**
 * Validates the `bonobo:init` context union: `kind: "page"` or `kind: "file_view"`.
 *
 * @param {unknown} value
 */
function is_ui_context(value) {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const context = /** @type {Record<string, unknown>} */ (value);
	if (
		typeof context.pluginName !== "string" ||
		typeof context.userId !== "string" ||
		typeof context.organizationId !== "string" ||
		typeof context.workspaceId !== "string"
	) {
		return false;
	}
	if (context.kind === "page") {
		return typeof context.pageId === "string" && typeof context.pageTitle === "string";
	}
	if (context.kind === "file_view") {
		if (typeof context.fileViewId !== "string" || typeof context.fileViewTitle !== "string") {
			return false;
		}
		if (typeof context.file !== "object" || context.file === null) {
			return false;
		}
		const file = /** @type {Record<string, unknown>} */ (context.file);
		return (
			typeof file.fileNodeId === "string" &&
			typeof file.name === "string" &&
			typeof file.path === "string" &&
			typeof file.contentType === "string"
		);
	}
	return false;
}

/**
 * Reads the host origin and frame nonce from the URL fragment. The fragment is available to the
 * page but is not sent in the asset request, cache key, or referrer.
 *
 * Why the host passes its origin at all: `postMessage` needs a target origin, and the SDK must
 * never send with `"*"`. The same SDK file runs under a localhost host and under the deployed
 * host, so it cannot hardcode the value, and it cannot discover it reliably either
 * (`document.referrer` depends on the referrer policy, `location.ancestorOrigins` is not in
 * Firefox). A wrong value only makes the SDK talk to nobody; it never grants anything. The value
 * is not authentication of the embedder. CSP `frame-ancestors` on the asset response decides who
 * may embed the frame, and only the host's session mint can produce a token.
 *
 * The checks below are format checks, not an allowlist: exactly these two keys, an origin with
 * no path or query, a UUIDv4 nonce.
 */
function read_bridge_bootstrap() {
	const fragment = window.location.hash.slice(1);
	if (!fragment) {
		throw new Error("Missing host bridge fragment — this plugin frame must be embedded by the Bonobo host app");
	}

	const params = new URLSearchParams(fragment);
	const parentOrigins = params.getAll("parentOrigin");
	const nonces = params.getAll("nonce");
	if (params.size !== 2 || parentOrigins.length !== 1 || nonces.length !== 1) {
		throw new Error("Invalid host bridge fragment");
	}

	const parentOrigin = parentOrigins[0];
	const nonce = nonces[0];
	let parsedParentOrigin;
	try {
		parsedParentOrigin = new URL(parentOrigin);
	} catch {
		throw new Error("Invalid host bridge parent origin");
	}
	if (
		(parsedParentOrigin.protocol !== "http:" && parsedParentOrigin.protocol !== "https:") ||
		parsedParentOrigin.origin !== parentOrigin
	) {
		throw new Error("Invalid host bridge parent origin");
	}
	if (!NONCE_PATTERN.test(nonce)) {
		throw new Error("Invalid host bridge nonce");
	}

	return { parentOrigin, nonce };
}

/**
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts `{ type: "bonobo:ready", nonce }` to `window.parent`,
 * and resolves with the frontend client when the host's `bonobo:init` arrives. `bonobo:init`
 * messages after the first are ignored.
 *
 * The host puts its canonical HTTP(S) origin and a fresh frame nonce in the URL fragment. The SDK
 * validates both before connecting, sends ready only to that exact origin, and accepts host
 * messages only from that origin, `window.parent`, and the matching nonce. The session token
 * travels over postMessage only and is never placed in a URL.
 *
 * The nonce is a conversation id for one mount of one iframe, not a secret. The host makes a new
 * one per mount and puts it in the URL, so a new mount always loads a fresh document. It does
 * three jobs: the host releases the token only after a ready message that carries it, which
 * proves this document read this mount's fragment; a late init or token from a previous mount
 * carries the old nonce and is dropped; and it backs up the `window.parent` check, because a
 * window keeps its identity across navigations while the document behind it changes.
 *
 * On init the SDK also opens the page's own Convex client against the init's `convexUrl`. The
 * client authenticates with the plugin-session JWT the host delivers beside the session token;
 * the page calls the plugin doors on that client directly. A host that sends no JWT is covered
 * by the same-origin `/plugins-ui/session-jwt` exchange.
 *
 * Token lifetimes, so plugin code never handles refresh itself: the session token and its JWT
 * live 30 minutes and expire together. `getToken` refreshes both through the host when they are
 * expired or within 60 seconds of expiry, and a normal API call that meets a 401 refreshes once
 * and retries once. The Convex client asks for a new JWT 10 seconds before it expires, which is
 * inside that margin, so its own ask is what drives the host refresh: one cadence for both
 * credentials. The host rotates the token on the same session while that session lives. When the
 * session is already gone (the device slept past its expiry), the host mints a new session for
 * this same frame and answers the same refresh with its token and JWT, so the page keeps its
 * state; the SDK treats that answer like any rotation. The session record on the host is the
 * kill switch: every plugin door reads it on each call, so revoking it ends every live
 * subscription at once whatever a JWT says.
 *
 * Secrets never reach this frame. A `plu_` token has no secrets scope, and the SDK has no
 * secrets API. A page that needs a secret calls its own backend through `backend.invoke`; the
 * backend run reads the secret with `env.BONOBO.secrets.get(name)`.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>}
 */
export async function bonobo_ui_connect() {
	const { parentOrigin, nonce } = read_bridge_bootstrap();

	// Token state — set by `bonobo:init`, updated by `bonobo:token` and the JWT exchange.
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;
	// The plugin-session JWT delivered beside the token. Empty when the host sent none; the exchange
	// fallback then fills it.
	let jwt = "";
	let jwtExpiresAt = 0;

	/**
	 * Theme state — set by `bonobo:init`, replaced by `bonobo:theme` when the member switches the
	 * host's theme. Each one is painted onto the document as it arrives. It stays null when the host
	 * sends none, and then the document keeps the page's own colours.
	 *
	 * @type {import("bonobo-plugin-sdk/frontend").BonoboUiTheme | null}
	 */
	let theme = null;
	/** @type {Set<(theme: import("bonobo-plugin-sdk/frontend").BonoboUiTheme) => void>} */
	const themeSubscribers = new Set();

	/** @type {Map<string, { resolve: (token: string) => void, reject: (error: Error) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_refreshes = new Map();
	/** @type {Promise<string> | null} */
	let refresh_in_flight = null;

	/**
	 * Returns the current session token, refreshing it first when it is expired or within
	 * `TOKEN_EXPIRY_MARGIN_MS` of `tokenExpiresAt`.
	 *
	 * @returns {Promise<string>}
	 */
	async function getToken() {
		if (Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) {
			return refreshToken();
		}
		return token;
	}

	/**
	 * Asks the host for a fresh session token. Concurrent callers share one in-flight
	 * `bonobo:token-refresh-request`; it resolves on the matching `bonobo:token` and rejects on
	 * the matching `bonobo:token-error`.
	 *
	 * @returns {Promise<string>}
	 */
	function refreshToken() {
		if (refresh_in_flight) {
			return refresh_in_flight;
		}
		const requestId = crypto.randomUUID();
		refresh_in_flight = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending_refreshes.delete(requestId);
				reject(new Error("Plugin frame token refresh timed out"));
			}, REFRESH_DEADLINE_MS);
			pending_refreshes.set(requestId, { resolve, reject, timeout });
			try {
				window.parent.postMessage({ type: "bonobo:token-refresh-request", nonce, requestId }, parentOrigin);
			} catch (error) {
				clearTimeout(timeout);
				pending_refreshes.delete(requestId);
				reject(error);
			}
		}).finally(() => {
			refresh_in_flight = null;
		});
		return refresh_in_flight;
	}

	const jwt_is_fresh = () => jwt !== "" && Date.now() < jwtExpiresAt - TOKEN_EXPIRY_MARGIN_MS;

	/**
	 * Stores the JWT a host message delivered beside the token, or clears it when the message
	 * carried none (an older host): the exchange fallback then takes over.
	 *
	 * @param {{ jwt?: unknown, jwtExpiresAt?: unknown }} message
	 */
	const store_delivered_jwt = (message) => {
		if (
			typeof message.jwt === "string" &&
			typeof message.jwtExpiresAt === "number" &&
			Number.isFinite(message.jwtExpiresAt)
		) {
			jwt = message.jwt;
			jwtExpiresAt = message.jwtExpiresAt;
		} else {
			jwt = "";
			jwtExpiresAt = 0;
		}
	};

	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. When `init.body`
	 * is set it is JSON-encoded and sent with `Content-Type: application/json`, and the default
	 * method is `POST`; without a body the default method is `GET`. On a `401` the client
	 * refreshes the token and retries exactly once. Ok responses resolve with the parsed JSON
	 * body; non-ok responses throw an `Error` carrying `status` and `responseText`.
	 *
	 * @param {string} path - Public API path starting with `/`, e.g. `"/api/v1/files/list"`.
	 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [init]
	 * @returns {Promise<unknown>}
	 */
	async function fetchJson(path, init) {
		const has_body = init?.body !== undefined;
		/** @param {string} bearer */
		const send = (bearer) => {
			const headers = new Headers(init?.headers);
			headers.set("Authorization", `Bearer ${bearer}`);
			if (has_body) {
				headers.set("Content-Type", "application/json");
			}
			return fetch(apiOrigin + path, {
				method: init?.method ?? (has_body ? "POST" : "GET"),
				headers,
				body: has_body ? JSON.stringify(init.body) : undefined,
			});
		};

		const firstBearer = await getToken();
		let response = await send(firstBearer);
		if (response.status === 401) {
			// Another request may already have rotated this captured bearer. Reuse the current
			// token in that case so a late 401 cannot rotate the fresh token again.
			response = await send(token !== firstBearer ? token : await refreshToken());
		}
		if (!response.ok) {
			const responseText = await response.text();
			throw Object.assign(new Error(`${path} responded ${response.status}: ${responseText}`), {
				status: response.status,
				responseText,
			});
		}
		return response.json();
	}

	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["backend"]} */
	const backend = {
		invoke(opts) {
			return fetchJson("/api/v1/plugin-backend/invoke", {
				body: {
					endpoint: opts.endpoint,
					...(opts.input === undefined ? {} : { input: opts.input }),
					...(opts.serializationKey === undefined ? {} : { serializationKey: opts.serializationKey }),
				},
			})
				.then((response) => {
					const result = read_backend_invoke_success(response);
					if (result === undefined) {
						console.error("[bonobo-plugin-sdk] Plugin backend invoke response was invalid");
						return { _nay: { name: "unavailable", message: "Failed to run the plugin backend" } };
					}
					return { _yay: result };
				})
				.catch((error) => {
					const errorRecord =
						typeof error === "object" && error !== null ? /** @type {Record<string, unknown>} */ (error) : null;
					const status = typeof errorRecord?.status === "number" ? errorRecord.status : null;
					/** @type {Record<string, unknown> | null} */
					let refusal = null;
					if (typeof errorRecord?.responseText === "string") {
						try {
							const parsed = JSON.parse(errorRecord.responseText);
							refusal = typeof parsed === "object" && parsed !== null ? parsed : null;
						} catch {
							refusal = null;
						}
					}
					const message = typeof refusal?.message === "string" ? refusal.message : null;

					// 409 is the serialization lock, 429 the member's invoke rate bucket. Both mean
					// "wait and try again" and both carry retryAfterMs, so the page handles them as one.
					if (status === 409 || status === 429) {
						return {
							_nay: {
								name: "busy",
								message: message ?? "The plugin backend is busy",
								...(typeof refusal?.retryAfterMs === "number" ? { retryAfterMs: refusal.retryAfterMs } : {}),
							},
						};
					}
					// The server refuses a lapsed session and a revoked plugin the same way, and the
					// SDK's own session clock is the whole difference. A page that reads the doors
					// directly makes the same split with `session.expiresAt()`.
					if (status === 401 || status === 403) {
						if (Date.now() >= tokenExpiresAt) {
							return { _nay: { name: "session_expired", message: "This plugin session expired" } };
						}
						return { _nay: { name: "denied", message: message ?? "This plugin may not run its backend here" } };
					}
					if (status !== null && status < 500 && message !== null) {
						return { _nay: { name: "invalid", message } };
					}
					// A thrown refresh (the session doc is gone) reaches here with no status at all.
					if (Date.now() >= tokenExpiresAt) {
						return { _nay: { name: "session_expired", message: "This plugin session expired" } };
					}
					console.error("[bonobo-plugin-sdk] Plugin backend invoke failed:", error);
					return { _nay: { name: "unavailable", message: "Failed to run the plugin backend" } };
				});
		},
	};

	/**
	 * Fallback for a host that delivered no JWT: exchanges the session token for the plugin-session
	 * JWT at the asset origin's `/plugins-ui/session-jwt` route. For a published frame this is a
	 * same-origin JSON POST with no preflight, and the route answers no other origin, so the JWT
	 * never becomes readable cross-origin. The one exception is the app's development-only frame
	 * override: a dev deployment may allowlist exactly one extra origin for this route, and the
	 * same POST then runs preflighted from there.
	 *
	 * @param {string} sessionToken
	 */
	const exchange_session_jwt = (sessionToken) =>
		fetch(apiOrigin + "/plugins-ui/session-jwt", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: sessionToken }),
		});

	/**
	 * The Convex client's auth callback. The stored JWT answers while it is fresh, so a startup or
	 * a wake from a short sleep costs no request at all.
	 *
	 * This chain is also what keeps an open page alive. When the stored JWT is inside the 60-second
	 * margin, or Convex refused the very JWT it holds (a forced refetch for it), one host refresh
	 * replaces both credentials, and that host refresh EXTENDS the session and moves its scheduled
	 * deletion. A page that slept past the session expiry recovers here too: the host finds the
	 * session doc gone, mints a new session for this same frame, and answers the refresh with the
	 * new token and JWT, so the Convex client re-runs its query set under the new session. Only
	 * when the host refuses to mint (uninstalled, membership ended, rate limit) does every path
	 * below answer null, and null tells the Convex client this page is unauthenticated (its
	 * subscriptions die; by then the host has replaced the frame with its error state and Retry).
	 *
	 * A host that sends no JWT falls through to the exchange.
	 *
	 * @param {{ forceRefreshToken: boolean }} [args]
	 */
	async function fetch_convex_jwt(args) {
		const forceRefreshToken = args?.forceRefreshToken === true;
		// A transient failure must not answer null: the Convex client treats one null as a final
		// "unauthenticated" and never asks again, so a two-second network blip or a 429 from the
		// exchange bucket would kill the page for good. Retry the transient shapes (thrown refresh or
		// fetch, 429, 5xx) a few times before giving up; a hard refusal still answers null right away.
		for (let attempt = 0; ; attempt += 1) {
			// The stored JWT answers a plain ask while it is fresh. A forced ask (the Convex client's
			// own expiry timer, or a server refusal) must end in a JWT issued now: the client schedules
			// its next ask from that JWT's `exp - iat`, as if it had just been issued, so a stored JWT
			// that a REST call rotated earlier would make it wait past the real session end.
			if (jwt_is_fresh() && !forceRefreshToken) {
				return jwt;
			}

			/** @type {Response | null} */
			let response = null;
			try {
				// A delivered JWT is replaced through the host: the answer carries both credentials.
				if (jwt !== "") {
					await refreshToken();
					if (jwt_is_fresh()) {
						return jwt;
					}
					// The host answered a token without a JWT. Fall through to the exchange.
				}
				response = await exchange_session_jwt(await getToken());
				if (response.status === 401) {
					// The session went stale between the margin check and the exchange (for example
					// the device slept briefly). One host refresh, one re-exchange; a second refusal
					// means the session is gone.
					response = await exchange_session_jwt(await refreshToken());
				}
			} catch {
				response = null;
			}

			if (response?.ok) {
				const body = await response.json().catch(() => null);
				const exchangedJwt = body?._yay?.jwt;
				const sessionExpiresAt = body?._yay?.sessionExpiresAt;
				if (typeof exchangedJwt !== "string" || typeof sessionExpiresAt !== "number") {
					return null;
				}
				// Keep the stored expiry in sync with the server's view of the session, so
				// getToken's refresh margin stays anchored to the real session end.
				tokenExpiresAt = sessionExpiresAt;
				jwt = exchangedJwt;
				jwtExpiresAt = sessionExpiresAt;
				return exchangedJwt;
			}

			const transient = response === null || response.status === 429 || response.status >= 500;
			if (!transient || attempt >= 2) {
				return null;
			}
			await new Promise((resolveWait) => setTimeout(resolveWait, 1000 * (attempt + 1)));
		}
	}

	/** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>} */
	const client_promise = new Promise((resolve) => {
		let initialized = false;
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let readyInterval;

		const post_ready = () => {
			window.parent.postMessage({ type: "bonobo:ready", nonce }, parentOrigin);
		};

		const stop_ready = () => {
			clearInterval(readyInterval);
		};

		/** @param {MessageEvent} event */
		const handle_message = (event) => {
			if (event.source !== window.parent || event.origin !== parentOrigin) {
				return;
			}
			const message = event.data;
			if (typeof message !== "object" || message === null) {
				return;
			}
			if (
				message.type === "bonobo:init" &&
				!initialized &&
				message.nonce === nonce &&
				typeof message.apiOrigin === "string" &&
				typeof message.convexUrl === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt) &&
				is_ui_context(message.context)
			) {
				initialized = true;
				stop_ready();
				window.removeEventListener("pagehide", stop_ready);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				store_delivered_jwt(message);
				// The page talks to Convex itself, through the React client so the `convex/react`
				// hooks work on it. expectAuth keeps queries parked until the first JWT arrives, so a
				// subscription never runs an unauthenticated round first. initialAuthTokenReuse makes
				// the client schedule its refetch from the delivered JWT's expiry. Without it the
				// client forces a second fetch right after the first JWT is confirmed, which would
				// refresh the session at every startup.
				const convexClient = new ConvexReactClient(message.convexUrl, {
					expectAuth: true,
					unsavedChangesWarning: false,
					initialAuthTokenReuse: true,
				});
				let lastAuthWakePollAt = Date.now();
				const authWakeInterval = setInterval(() => {
					const now = Date.now();
					if (now - lastAuthWakePollAt >= AUTH_WAKE_GAP_MS) {
						// setAuth pauses the socket before it fetches. That keeps the old session's
						// query set from returning a permanent null while the host re-mints it.
						convexClient.setAuth(fetch_convex_jwt);
					}
					lastAuthWakePollAt = now;
				}, AUTH_WAKE_POLL_MS);
				convexClient.setAuth(fetch_convex_jwt);
				// The document is going away (unload or bfcache). Close the client so the server
				// drops this page's subscriptions; a page restored from bfcache stays frozen and
				// needs a reload.
				window.addEventListener(
					"pagehide",
					() => {
						clearInterval(authWakeInterval);
						void convexClient.close();
					},
					{ once: true },
				);
				theme = read_theme(message.theme);
				if (theme) {
					apply_theme(theme);
				}
				resolve({
					context: message.context,
					apiOrigin,
					getToken,
					refreshToken,
					fetchJson,
					backend,
					convex: convexClient,
					api: bonobo_convex_api,
					session: {
						// The one thing that tells a lapsed session apart from a refused read. The
						// doors answer the same opaque null (or empty page) for both, so this clock is
						// the whole difference, and it lives in this closure.
						expiresAt: () => tokenExpiresAt,
						fetchJwt: fetch_convex_jwt,
					},
					theme: {
						current: () => theme,
						subscribe(onChange) {
							themeSubscribers.add(onChange);
							return () => {
								themeSubscribers.delete(onChange);
							};
						},
					},
				});
			} else if (
				initialized &&
				message.nonce === nonce &&
				message.type === "bonobo:token" &&
				typeof message.requestId === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt)
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					token = message.token;
					tokenExpiresAt = message.tokenExpiresAt;
					store_delivered_jwt(message);
					pending.resolve(message.token);
				}
			} else if (initialized && message.nonce === nonce && message.type === "bonobo:theme") {
				const next = read_theme(message.theme);
				if (next) {
					theme = next;
					// Paint first, so a subscriber that reads computed styles sees the new theme.
					apply_theme(next);
					for (const onChange of themeSubscribers) {
						onChange(next);
					}
				}
			} else if (
				initialized &&
				message.nonce === nonce &&
				message.type === "bonobo:token-error" &&
				typeof message.requestId === "string" &&
				typeof message.message === "string"
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.reject(new Error(message.message));
				}
			}
			// Anything else (unknown types, replayed inits, stray requestIds) is silently ignored.
		};

		window.addEventListener("message", handle_message);
		window.addEventListener("pagehide", stop_ready, { once: true });
		post_ready();
		readyInterval = setInterval(post_ready, READY_RETRY_MS);
	});

	return client_promise;
}
