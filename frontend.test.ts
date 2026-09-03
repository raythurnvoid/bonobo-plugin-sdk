import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bonobo_connect } from "./frontend.js";

const HOST_ORIGIN = "https://host.test";
const NONCE = "0f8fad5b-d9cb-469f-a165-70867728950e";
const CONVEX_URL = "https://deployment.convex.test";

type FakeConvexClientInstance = {
	address: string;
	options: Record<string, unknown>;
	fetchToken: ((args?: { forceRefreshToken: boolean }) => Promise<string | null>) | null;
	setAuthCalls: number;
	closed: boolean;
};

const fakeConvex = vi.hoisted(() => ({
	instances: [] as unknown[],
}));

// The real client opens a WebSocket at construction, so every client-backed test runs against
// this fake. The SDK only constructs the client, hands it the auth callback, and closes it; the
// doors themselves are called by the plugin, not by the SDK.
vi.mock("convex/react", () => ({
	ConvexReactClient: class FakeConvexReactClient {
		address: string;
		options: Record<string, unknown>;
		fetchToken: ((args?: { forceRefreshToken: boolean }) => Promise<string | null>) | null = null;
		setAuthCalls = 0;
		closed = false;
		constructor(address: string, options: Record<string, unknown>) {
			this.address = address;
			this.options = options;
			fakeConvex.instances.push(this);
		}
		setAuth(fetchToken: (args?: { forceRefreshToken: boolean }) => Promise<string | null>) {
			this.fetchToken = fetchToken;
			this.setAuthCalls += 1;
		}
		close() {
			this.closed = true;
		}
	},
}));

function convex_instance() {
	const instance = fakeConvex.instances.at(-1) as FakeConvexClientInstance | undefined;
	if (!instance) {
		throw new Error("ConvexReactClient not constructed");
	}
	return instance;
}

function set_bridge_fragment(parentOrigin = HOST_ORIGIN, nonce = NONCE) {
	window.history.replaceState(null, "", `/#${new URLSearchParams({ parentOrigin, nonce }).toString()}`);
}

/**
 * Simulates one host → page postMessage.
 */
function post_from_host(data: unknown, origin: string = HOST_ORIGIN, source: MessageEventSource = window): void {
	window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
}

function make_init(overrides?: Record<string, unknown>) {
	return {
		type: "bonobo:init",
		nonce: NONCE,
		apiOrigin: "https://api.test",
		convexUrl: CONVEX_URL,
		token: "plu_1",
		tokenExpiresAt: Date.now() + 600_000,
		context: {
			kind: "page",
			pluginName: "gallery",
			userId: "user_1",
			pageId: "main",
			pageTitle: "Gallery",
			organizationId: "org_1",
			workspaceId: "ws_1",
		},
		...overrides,
	};
}

function make_file_view_context(overrides?: Record<string, unknown>) {
	return {
		kind: "file_view",
		pluginName: "video-player",
		userId: "user_1",
		fileViewId: "player",
		fileViewTitle: "Video player",
		organizationId: "org_1",
		workspaceId: "ws_1",
		file: {
			fileNodeId: "node_1",
			name: "clip.mp4",
			path: "/clips/clip.mp4",
			contentType: "video/mp4",
		},
		...overrides,
	};
}

/**
 * happy-dom cannot deliver a real cross-origin parent postMessage, so record it directly.
 */
function spy_on_post_message() {
	return vi.spyOn(window, "postMessage").mockImplementation(() => {});
}

function refresh_requests(postSpy: ReturnType<typeof spy_on_post_message>) {
	return postSpy.mock.calls.filter((call) => (call[0] as { type?: string }).type === "bonobo:token-refresh-request");
}

function answer_refresh(
	postSpy: ReturnType<typeof spy_on_post_message>,
	token: string,
	overrides?: Record<string, unknown>,
) {
	const request = refresh_requests(postSpy).at(-1)?.[0] as { requestId: string } | undefined;
	if (!request) {
		throw new Error("refresh request not posted");
	}
	post_from_host({
		type: "bonobo:token",
		nonce: NONCE,
		requestId: request.requestId,
		token,
		tokenExpiresAt: Date.now() + 600_000,
		...overrides,
	});
	return request.requestId;
}

async function connect_client() {
	spy_on_post_message();
	const clientPromise = bonobo_connect();
	post_from_host(make_init());
	return await clientPromise;
}

beforeEach(() => {
	set_bridge_fragment();
});

afterEach(() => {
	window.history.replaceState(null, "", "/");
	fakeConvex.instances.length = 0;
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("bonobo_connect", () => {
	test("rejects a missing or malformed host bridge fragment", async () => {
		window.history.replaceState(null, "", "/");
		await expect(bonobo_connect()).rejects.toThrow("Missing host bridge fragment");

		// A plugin that ships only file views renders this rejection verbatim to the member (the
		// video player's `main.tsx` does exactly that). A member in a file view is not on a page,
		// so the wording must name the frame instead. Pin the rule, not the sentence: re-wording
		// is fine, calling the frame a page is not.
		let bridgeMessage = "";
		await bonobo_connect().catch((error: unknown) => {
			bridgeMessage = error instanceof Error ? error.message : String(error);
		});
		expect(bridgeMessage).not.toMatch(/page/i);

		set_bridge_fragment("ftp://host.test");
		await expect(bonobo_connect()).rejects.toThrow("Invalid host bridge parent origin");

		set_bridge_fragment("https://host.test/");
		await expect(bonobo_connect()).rejects.toThrow("Invalid host bridge parent origin");

		set_bridge_fragment(HOST_ORIGIN, "not-a-uuid");
		await expect(bonobo_connect()).rejects.toThrow("Invalid host bridge nonce");

		window.history.replaceState(
			null,
			"",
			`/#${new URLSearchParams({ parentOrigin: HOST_ORIGIN, nonce: NONCE, extra: "value" })}`,
		);
		await expect(bonobo_connect()).rejects.toThrow("Invalid host bridge fragment");
	});

	test("sends nonce-bound ready to the exact parent and accepts only its matching init", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		expect(postSpy).toHaveBeenCalledWith({ type: "bonobo:ready", nonce: NONCE }, HOST_ORIGIN);

		post_from_host(make_init({ token: "plu_wrong_source" }), HOST_ORIGIN, {} as Window);
		post_from_host(make_init({ token: "plu_wrong_origin" }), "https://wrong-host.test");
		post_from_host(make_init({ nonce: crypto.randomUUID(), token: "plu_bad_nonce" }));
		post_from_host(make_init({ tokenExpiresAt: Number.NaN, token: "plu_bad_shape" }));
		post_from_host(make_init({ convexUrl: undefined, token: "plu_no_convex_url" }));
		post_from_host(make_init());
		const client = await clientPromise;

		expect(client.apiOrigin).toBe("https://api.test");
		expect(client.context.kind === "page" && client.context.pageTitle).toBe("Gallery");
		await expect(client.getToken()).resolves.toBe("plu_1");
	});

	test("init opens the page's own Convex client and closes it on pagehide", async () => {
		await connect_client();

		const instance = convex_instance();
		expect(instance.address).toBe(CONVEX_URL);
		// expectAuth parks queries until the first JWT; the SDK never wants the unsaved-changes
		// beforeunload handler inside a sandboxed iframe.
		// initialAuthTokenReuse makes the client schedule its refetch from the delivered JWT's
		// expiry; without it the client forces a second fetch right after the first JWT is
		// confirmed, which would refresh the session at every startup.
		expect(instance.options).toEqual({ expectAuth: true, unsavedChangesWarning: false, initialAuthTokenReuse: true });
		expect(instance.fetchToken).toBeTypeOf("function");
		expect(instance.closed).toBe(false);

		window.dispatchEvent(new Event("pagehide"));
		expect(instance.closed).toBe(true);
	});

	test("resolves the frame's own Convex client and the typed door references", async () => {
		const client = await connect_client();

		// One client per frame: the page's hooks and direct calls share its authentication, and it
		// closes with the frame on pagehide. A second client would mean a second socket and a
		// second JWT fetch per frame.
		expect(fakeConvex.instances).toHaveLength(1);
		expect(client.convex).toBe(convex_instance());

		// At runtime a reference is an `anyApi` path; the generated types exist only at compile time.
		expect(getFunctionName(client.api.plugins_data.list_members)).toBe("plugins_data:list_members");
		expect(getFunctionName(client.api.plugins_data.watch_documents)).toBe("plugins_data:watch_documents");
		expect(getFunctionName(client.api.plugins_data.watch_documents_page)).toBe("plugins_data:watch_documents_page");
	});

	test("declares the React client, the session, and the generated door types, and no wrapper", async () => {
		// Read as text for the reason the fetchJson test gives: vitest never type-checks
		// `frontend.d.ts`, so a type-level assertion here would never run. The typecheck script
		// compiles `frontend.test-d.ts` against it instead.
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		expect(declaration).toMatch(/^\tconvex: ConvexReactClient;$/m);
		expect(declaration).toMatch(/^\tapi: BonoboConvexApi;$/m);
		expect(declaration).toMatch(/^\tsession: \{$/m);
		expect(declaration).toMatch(/^\t\texpiresAt\(\): number;$/m);

		// The wrappers left in 0.13.0. A plugin reads the doors with the Convex client itself.
		expect(declaration).not.toMatch(/^\t(data|members|scopes): \{$/m);
		expect(declaration).not.toMatch(/watchWindow|BonoboWatchDeathInfo|BonoboScope\b|BonoboMember\b/);

		// The generated file is its own export, so a plugin can name the type without the client.
		const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "package.json"), "utf8")) as {
			exports: Record<string, unknown>;
		};
		expect(packageJson.exports["./convex-api"]).toEqual({ types: "./convex-api.d.ts" });

		// The shipped file must stand alone: the generator inlines every app type, so a plugin
		// never depends on app source. A relative import here would break every consumer.
		const generated = await readFile(join(import.meta.dirname, "convex-api.d.ts"), "utf8");
		expect(generated).toMatch(/^export type BonoboConvexApi = \{$/m);
		expect(generated).not.toMatch(/import\("\.\.?\//);
	});

	test("ships the generated HTTP route table as its own export", async () => {
		// Same rules as the Convex file above, applied to the second generated file: it is exported
		// on its own path so a plugin can name the type without a client, and it must not reach back
		// into app source.
		const packageJson = JSON.parse(await readFile(join(import.meta.dirname, "package.json"), "utf8")) as {
			exports: Record<string, unknown>;
		};
		expect(packageJson.exports["./http-api"]).toEqual({ types: "./http-api.d.ts" });

		const generated = await readFile(join(import.meta.dirname, "http-api.d.ts"), "utf8");
		expect(generated).toMatch(/^export type BonoboHttpApi = \{$/m);
		expect(generated).toMatch(/^export type BonoboHttpApiPath = keyof BonoboHttpApi;$/m);
		// The answer union `fetchJson` resolves with. It lives in the generated file because it is
		// part of the route contract: an author who writes their own `fetch` needs it without
		// importing `frontend`.
		expect(generated).toMatch(/^export type BonoboHttpResponse<P extends BonoboHttpApiPath> = \{$/m);
		expect(generated).not.toMatch(/import\("\.\.?\//);

		// The seven routes a UI token reaches. A generator run that drops one of these would make
		// `client.fetchJson` reject a call the host still serves.
		for (const path of [
			"/api/v1/plugin-data/read",
			"/api/v1/plugin-data/list",
			"/api/v1/files/list",
			"/api/v1/files/read",
			"/api/v1/files/download-urls",
			"/api/v1/plugin-backend/invoke",
			"/plugins-ui/session-jwt",
		]) {
			expect(generated).toContain(`\t"${path}": {`);
		}

		// `fetchJson` types its body as `BonoboHttpApi[P]["POST"]["body"]`, so every route in the
		// table must have a POST member. A route without one makes that index invalid, but the
		// error is raised inside `frontend.d.ts`, and `--skipLibCheck` hides it in this package and
		// in every first-party plugin. So nothing else would notice a GET-only or OPTIONS-only route
		// being added to the generator's list, and that route's body check would silently accept
		// anything. `/plugins-ui/session-jwt` already carries an OPTIONS member, so other methods do
		// reach this file.
		const routeBlocks = generated.split(/^\t"/m).slice(1);
		expect(routeBlocks.length).toBeGreaterThan(0);
		for (const block of routeBlocks) {
			const routePath = block.slice(0, block.indexOf('"'));
			expect({ routePath, hasPost: block.includes("\n\t\tPOST: {") }).toEqual({ routePath, hasPost: true });
		}

		// `BonoboHttpResponse` drops the statuses `fetchJson` throws instead of resolving. The
		// runtime tests `status >= 500`; a conditional type cannot, so the generator spells the
		// codes out. Read every 5xx the table declares and require the list to name it, or the
		// union would keep a member no caller can ever reach.
		const droppedStatuses = generated.match(/^export type BonoboHttpResponse[^]*?\n\t\t\? never$/m)?.[0] ?? "";
		const declaredStatuses = new Set([...generated.matchAll(/^\t{4}(\d{3}): \{$/gm)].map((match) => match[1]!));
		const declared5xx = [...declaredStatuses].filter((status) => Number(status) >= 500).sort();
		expect(declared5xx.length).toBeGreaterThan(0);
		for (const status of declared5xx) {
			expect({ status, dropped: droppedStatuses.includes(`| ${status}\n`) }).toEqual({ status, dropped: true });
		}

		// The app resolves the schema before it is printed, so nothing here may still point back at
		// the app's own type names, and no property may carry the `readonly` its `as const` handlers
		// gave it.
		expect(generated).not.toMatch(/\btypeof\b|api_schemas_Main|\bExpand\b|\breadonly\b/);

		// Every status must carry the body its handler answers. A handler that returns one object
		// with a union `status` used to print `never` for each of those statuses, and a handler that
		// returned a bare `page: []` printed `never[]` for that array. Both collapses have happened.
		//
		// Pin them here, because `never` is assignable to everything. A plugin that checks its own
		// parsers against this table would go green against a collapsed body and learn nothing, and
		// no compiler error would point at the generator. This is the one place that can see it.
		expect(generated).not.toContain("body: never");
		expect(generated).not.toMatch(/\bnever\[\]/);
	});

	test("accepts a file-view context and rejects contexts with a missing or unknown kind", async () => {
		spy_on_post_message();
		const clientPromise = bonobo_connect();

		post_from_host(make_init({ context: make_file_view_context({ kind: undefined }), token: "plu_no_kind" }));
		post_from_host(make_init({ context: make_file_view_context({ kind: "backend" }), token: "plu_bad_kind" }));
		post_from_host(make_init({ context: make_file_view_context({ file: undefined }), token: "plu_no_file" }));
		post_from_host(
			make_init({ context: make_file_view_context({ file: { fileNodeId: "node_1" } }), token: "plu_bad_file" }),
		);
		post_from_host(make_init({ context: make_file_view_context() }));
		const client = await clientPromise;

		expect(client.context).toEqual(make_file_view_context());
		await expect(client.getToken()).resolves.toBe("plu_1");

		// The refresh timeout reaches the member from a file view too: the video player passes it
		// to `setErrorMessage` and renders it. Same rule as the bridge refusal above — the message
		// must not tell a member in a file view that they are on a page.
		vi.useFakeTimers();
		let refreshMessage = "";
		const refreshSettled = client.refreshToken().catch((error: unknown) => {
			refreshMessage = error instanceof Error ? error.message : String(error);
		});
		await vi.advanceTimersByTimeAsync(10_000);
		await refreshSettled;
		expect(refreshMessage).toContain("token refresh timed out");
		expect(refreshMessage).not.toMatch(/page/i);
	});

	test("requires userId in the init context for both kinds", async () => {
		spy_on_post_message();
		const clientPromise = bonobo_connect();

		post_from_host(make_init({ context: { ...make_init().context, userId: undefined }, token: "plu_no_user" }));
		post_from_host(
			make_init({ context: make_file_view_context({ userId: undefined }), token: "plu_no_user_file_view" }),
		);
		post_from_host(make_init());
		const client = await clientPromise;

		expect(client.context.userId).toBe("user_1");
		await expect(client.getToken()).resolves.toBe("plu_1");
	});

	test("keeps retrying ready because the host owns the startup deadline", async () => {
		vi.useFakeTimers();
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();

		await vi.advanceTimersByTimeAsync(15_500);
		expect(
			postSpy.mock.calls.filter((call) => (call[0] as { type?: string }).type === "bonobo:ready").length,
		).toBeGreaterThan(20);

		post_from_host(make_init());
		await expect(clientPromise).resolves.toMatchObject({ apiOrigin: "https://api.test" });
	});

	test("shares one token refresh across simultaneous 401 responses", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const fetchMock = vi
			.fn<(url: string, init: { method: string; headers: Headers; body?: string }) => Promise<Response>>()
			.mockResolvedValueOnce(new Response("expired", { status: 401 }))
			.mockResolvedValueOnce(new Response("expired", { status: 401 }))
			.mockImplementation(() =>
				Promise.resolve(
					new Response(JSON.stringify({ ok: true }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		const first = client.fetchJson("/api/v1/files/list", { limit: 100 });
		const second = client.fetchJson("/api/v1/files/list", { limit: 100 });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		await expect(Promise.all([first, second])).resolves.toEqual([
			{ status: 200, body: { ok: true } },
			{ status: 200, body: { ok: true } },
		]);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(fetchMock.mock.calls[0]?.[1].headers.get("Authorization")).toBe("Bearer plu_1");
		expect(fetchMock.mock.calls[2]?.[1].headers.get("Authorization")).toBe("Bearer plu_2");
	});

	test("a delayed 401 retries the token another request already refreshed", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		let resolveDelayed401: ((response: Response) => void) | null = null;
		const delayed401 = new Promise<Response>((resolve) => {
			resolveDelayed401 = resolve;
		});
		const fetchMock = vi.fn((url: string, init: { headers: Headers }): Promise<Response> => {
			const bearer = init.headers.get("Authorization");
			if (url.endsWith("/files/list") && bearer === "Bearer plu_1") {
				return Promise.resolve(new Response("expired", { status: 401 }));
			}
			if (url.endsWith("/files/read") && bearer === "Bearer plu_1") {
				return delayed401;
			}
			return Promise.resolve(
				new Response(JSON.stringify({ bearer }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const first = client.fetchJson("/api/v1/files/list", { limit: 100 });
		const second = client.fetchJson("/api/v1/files/read", { path: "/notes.md" });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");
		await expect(first).resolves.toEqual({ status: 200, body: { bearer: "Bearer plu_2" } });

		resolveDelayed401?.(new Response("late expired", { status: 401 }));
		await expect(second).resolves.toEqual({ status: 200, body: { bearer: "Bearer plu_2" } });
		expect(refresh_requests(postSpy)).toHaveLength(1);
	});

	test("resolves the second 401 as a declared answer instead of starting another refresh cycle", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ message: "Unauthenticated" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const result = client.fetchJson("/api/v1/files/list", { limit: 100 });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		// 401 is a status the route declares, so the second one is an answer, not a throw.
		await expect(result).resolves.toEqual({ status: 401, body: { message: "Unauthenticated" } });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(refresh_requests(postSpy)).toHaveLength(1);
	});

	test("shares refresh failure and lets a later request try again", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const first = client.refreshToken();
		const second = client.refreshToken();
		const firstRejected = expect(first).rejects.toThrow("Refresh denied");
		const secondRejected = expect(second).rejects.toThrow("Refresh denied");
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		const firstRequest = refresh_requests(postSpy)[0]?.[0] as { requestId: string };
		post_from_host({
			type: "bonobo:token-error",
			nonce: NONCE,
			requestId: firstRequest.requestId,
			message: "Refresh denied",
		});
		await Promise.all([firstRejected, secondRejected]);

		const later = client.refreshToken();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(2));
		answer_refresh(postSpy, "plu_3");
		await expect(later).resolves.toBe("plu_3");
	});

	test("ignores refresh replies with the wrong source, origin, or nonce", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;
		const refresh = client.refreshToken();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		const request = refresh_requests(postSpy)[0]?.[0] as { requestId: string };
		const reply = {
			type: "bonobo:token",
			nonce: NONCE,
			requestId: request.requestId,
			token: "plu_ignored",
			tokenExpiresAt: Date.now() + 600_000,
		};

		post_from_host(reply, HOST_ORIGIN, {} as Window);
		post_from_host(reply, "https://wrong-host.test");
		post_from_host({ ...reply, nonce: "wrong_nonce" });
		let settled = false;
		void refresh.finally(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		answer_refresh(postSpy, "plu_2");
		await expect(refresh).resolves.toBe("plu_2");
	});

	test("rejects a refresh that receives no host response and clears the single-flight request", async () => {
		vi.useFakeTimers();
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const firstRefresh = client.refreshToken();
		const rejected = expect(firstRefresh).rejects.toThrow("Plugin frame token refresh timed out");
		await vi.advanceTimersByTimeAsync(10_000);
		await rejected;

		const secondRefresh = client.refreshToken();
		expect(refresh_requests(postSpy)).toHaveLength(2);
		answer_refresh(postSpy, "plu_3");
		await expect(secondRefresh).resolves.toBe("plu_3");
	});

	test("resolves a declared status instead of throwing, and throws every 5xx", async () => {
		const client = await connect_client();
		const fetchMock = vi.fn((_url: string, _init: RequestInit): Promise<Response> => {
			throw new Error("not stubbed");
		});
		vi.stubGlobal("fetch", fetchMock);

		// A refusal the route declares is an answer. The old runtime threw here, so a page had to
		// parse `responseText` back out of an Error to read the wait.
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "Rate limit exceeded", retryAfterMs: 1500 }), {
				status: 429,
				headers: { "Content-Type": "application/json" },
			}),
		);
		await expect(client.fetchJson("/api/v1/plugin-backend/invoke", { endpoint: "refresh" })).resolves.toEqual({
			status: 429,
			body: { message: "Rate limit exceeded", retryAfterMs: 1500 },
		});

		// A 5xx is the one outcome no caller can act on, so it stays a throw whether the route
		// declares that status or not. The invoke route declares 502; it throws all the same, and
		// the generated union drops the member to match.
		fetchMock.mockResolvedValueOnce(new Response("gateway", { status: 502 }));
		await expect(client.fetchJson("/api/v1/plugin-backend/invoke", { endpoint: "refresh" })).rejects.toMatchObject({
			status: 502,
			responseText: "gateway",
		});

		fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
		await expect(client.fetchJson("/api/v1/files/list", { limit: 1 })).rejects.toMatchObject({
			status: 500,
			responseText: "boom",
		});
	});

	test("throws with the status when a sub-500 answer is not JSON", async () => {
		const client = await connect_client();
		// Convex's own router answers an unrouted path with plain text and a 404. A frame built
		// against a route table newer than the deployment it runs on meets exactly that. The status
		// and the raw text must survive, or the page cannot tell it apart from a network failure.
		const fetchMock = vi.fn(() =>
			Promise.resolve(new Response("No HttpAction routed for /api/v1/files/list", { status: 404 })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(client.fetchJson("/api/v1/files/list", { limit: 1 })).rejects.toMatchObject({
			status: 404,
			responseText: "No HttpAction routed for /api/v1/files/list",
		});
	});

	test("passes a failed session refresh out instead of turning it into an answer", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;
		const fetchMock = vi.fn(() => Promise.resolve(new Response("expired", { status: 401 })));
		vi.stubGlobal("fetch", fetchMock);

		// The host refuses to mint: the plugin was uninstalled, or the member lost access. The
		// refusal is not a route answer, so it must not arrive as one — it carries no status, and a
		// page written to narrow on `status` has to see it reject.
		const result = client.fetchJson("/api/v1/files/list", { limit: 1 });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		const request = refresh_requests(postSpy)[0]?.[0] as { requestId: string };
		post_from_host({
			type: "bonobo:token-error",
			nonce: NONCE,
			requestId: request.requestId,
			message: "This plugin was uninstalled",
		});

		await expect(result).rejects.toThrow("This plugin was uninstalled");
		await expect(result).rejects.not.toHaveProperty("status");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("owns the request fields it needs and passes the rest of init through", async () => {
		const client = await connect_client();
		const fetchMock = vi.fn(() =>
			Promise.resolve(
				new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const controller = new AbortController();
		await client.fetchJson(
			"/api/v1/files/list",
			{ limit: 100, kind: "file" },
			{
				signal: controller.signal,
				keepalive: true,
				cache: "no-store",
				headers: {
					"X-Trace": "1",
					// Header names are case-insensitive, so the type cannot forbid these three. The
					// runtime sets them last, and that is the whole enforcement.
					authorization: "Bearer stolen",
					"content-type": "text/plain",
					accept: "text/html",
				},
			},
		);

		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Headers }];
		expect(url).toBe("https://api.test/api/v1/files/list");
		expect(init.method).toBe("POST");
		expect(init.body).toBe(JSON.stringify({ limit: 100, kind: "file" }));
		// A redirect would resend the bearer to another origin, and no route redirects.
		expect(init.redirect).toBe("error");
		expect(init.signal).toBe(controller.signal);
		expect(init.keepalive).toBe(true);
		expect(init.cache).toBe("no-store");
		expect(init.headers.get("X-Trace")).toBe("1");
		expect(init.headers.get("Authorization")).toBe("Bearer plu_1");
		expect(init.headers.get("Content-Type")).toBe("application/json");
		expect(init.headers.get("Accept")).toBe("application/json");
	});

	test("lets an aborted request reject without a token refresh or a resend", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		// `fetch` is what refuses an aborted signal, so the stub does the same. What this checks is
		// the SDK's own behaviour around it: a rejection is not caught, not turned into an answer,
		// and not retried.
		const controller = new AbortController();
		controller.abort();
		const fetchMock = vi.fn((_url: string, init: RequestInit) =>
			init.signal?.aborted
				? Promise.reject(new DOMException("The operation was aborted.", "AbortError"))
				: Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(client.fetchJson("/api/v1/files/list", { limit: 1 }, { signal: controller.signal })).rejects.toThrow(
			"The operation was aborted.",
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(refresh_requests(postSpy)).toHaveLength(0);
	});

	test("authorize hands out the session bearer for a plugin that brings its own fetch", async () => {
		const client = await connect_client();

		const bare = await client.authorize();
		expect(bare).toBeInstanceOf(Headers);
		expect(bare.get("Authorization")).toBe("Bearer plu_1");

		// A plain object and a `Headers` instance are both `HeadersInit`, and the caller's own
		// headers survive.
		const fromObject = await client.authorize({ "X-Trace": "1" });
		expect(fromObject.get("X-Trace")).toBe("1");
		expect(fromObject.get("Authorization")).toBe("Bearer plu_1");

		const fromHeaders = await client.authorize(new Headers({ Authorization: "Bearer stolen" }));
		expect(fromHeaders.get("Authorization")).toBe("Bearer plu_1");
	});

	test("authorize refreshes first when the session is inside the expiry margin", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		// 30 seconds left is inside the 60-second margin `getToken` uses, so the host is asked
		// before the header is written.
		post_from_host(make_init({ tokenExpiresAt: Date.now() + 30_000 }));
		const client = await clientPromise;

		const authorized = client.authorize();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");
		await expect(authorized.then((headers) => headers.get("Authorization"))).resolves.toBe("Bearer plu_2");
	});

	test("pins the fetchJson answer contract in the declaration text", async () => {
		// Nothing in this package type-checks `frontend.d.ts`: `pnpm run typecheck` passes
		// `--skipLibCheck`, which skips every `.d.ts`, and vitest transpiles the tests without
		// checking types. So the signature is pinned as text.
		//
		// Build the path from `import.meta.dirname`, not from `new URL(..., import.meta.url)`. The
		// happy-dom environment resolves a relative URL against the fake document location, so that
		// form asks for `https://plugin.test/frontend.d.ts` and `readFile` refuses the scheme.
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		// Cut the declaration out first, from `fetchJson` to the line that ends it, so a failure
		// prints the signature instead of the whole file. Stop at the first line ending in `;`, not
		// at the first `>`: the return type is nested now, so a `[^>]*` scan would run past the
		// signature and swallow the next member.
		const fetchJsonDeclaration = declaration.match(/\bfetchJson<[^]*?\n\t\): [^\n]*;/)?.[0] ?? "";
		expect(fetchJsonDeclaration).toContain("fetchJson<P extends BonoboHttpApiPath>");
		// The body is its own parameter and the answer is the route's own status union. Both come
		// from the generated table, so a plugin needs no second parser for a shape the app types.
		expect(fetchJsonDeclaration).toContain('body: BonoboHttpApi[P]["POST"]["body"]');
		expect(fetchJsonDeclaration).toContain('init?: Omit<RequestInit, "method" | "body" | "redirect">');
		expect(fetchJsonDeclaration.endsWith("): Promise<BonoboHttpResponse<P>>;")).toBe(true);

		// `authorize` is the own-fetch primitive that replaced the thin wrapper idea.
		expect(declaration).toContain("authorize(headers?: HeadersInit): Promise<Headers>;");

		// The backend wrapper and its result type are gone with no alias, by the clean-slate rule.
		// Invoking the backend is `fetchJson` on the invoke route now.
		expect(declaration).not.toContain("BonoboBackendInvokeResult");
		expect(declaration).not.toMatch(/^\tbackend: \{$/m);

		// Read the implementation's own JSDoc too. It is the file a maintainer opens to edit
		// `fetchJson`, and the two files can disagree forever without a compile error.
		const implementation = await readFile(join(import.meta.dirname, "frontend.js"), "utf8");
		// Anchor on the block close so this reads fetchJson's own tag. Without the anchor the scan
		// returns the first `@returns` in the file that has `fetchJson` somewhere after it.
		const fetchJsonReturnsTag =
			implementation.match(/@returns \{Promise<[^}]*>\}(?=\s*\*\/\s*async function fetchJson\()/)?.[0] ?? "";
		expect(fetchJsonReturnsTag).toBe('@returns {Promise<import("bonobo-plugin-sdk/http-api").BonoboHttpResponse<P>>}');
		expect(implementation).not.toContain("read_backend_invoke_success");

		// The README states the same contract and then shows the one example a plugin author
		// copies. Read the file directly, because no gate in this package looks at the README.
		const readme = await readFile(join(import.meta.dirname, "README.md"), "utf8");
		// Cut out just the frontend example's fenced block, so a failure prints the snippet.
		const frontendExample = readme.match(/### Frontend page example\s*```js\n([^]*?)```/)?.[1] ?? "";
		expect(frontendExample).toContain("client.fetchJson");
		// The example must narrow on the status before it reads the body. The old one caught the
		// thrown error and read `status` off it, then checked the body shape by hand; a declared
		// status is an answer now, so neither belongs in the example any more.
		expect(frontendExample).toContain("res.status === 429");
		expect(frontendExample).toContain("res.status !== 200");
		expect(frontendExample).not.toContain('"status" in error');
		expect(frontendExample).not.toContain("safeParse");
	});
});

// `make_init` carries no JWT, so every test here runs the fallback: the SDK exchanges the token.
describe("convex session jwt auth", () => {
	function stub_exchange(responses: Response[] | ((body: { token: string }) => Response)) {
		const exchangeCalls: { token: string }[] = [];
		const queue = Array.isArray(responses) ? [...responses] : null;
		const fetchMock = vi.fn((url: string, init: { body: string }): Promise<Response> => {
			if (!url.endsWith("/plugins-ui/session-jwt")) {
				throw new Error(`Unexpected fetch: ${url}`);
			}
			const body = JSON.parse(init.body) as { token: string };
			exchangeCalls.push(body);
			if (queue) {
				const next = queue.shift();
				if (!next) {
					throw new Error("No stubbed exchange response left");
				}
				return Promise.resolve(next);
			}
			return Promise.resolve((responses as (body: { token: string }) => Response)(body));
		});
		vi.stubGlobal("fetch", fetchMock);
		return { fetchMock, exchangeCalls };
	}

	function jwt_response(jwt: string, sessionExpiresAt: number) {
		return new Response(JSON.stringify({ _yay: { jwt, sessionExpiresAt } }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	test("pauses for fresh auth after a long tab sleep", async () => {
		vi.useFakeTimers();
		const startedAt = Date.now();
		vi.setSystemTime(startedAt);
		await connect_client();
		const instance = convex_instance();
		expect(instance.setAuthCalls).toBe(1);

		// Moving the wall clock does not run timers. The next one-second poll sees the sleep gap
		// and calls setAuth before Convex's overdue reconnect and JWT timers can run.
		vi.setSystemTime(startedAt + 31_000);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(instance.setAuthCalls).toBe(2);

		window.dispatchEvent(new Event("pagehide"));
		vi.setSystemTime(startedAt + 62_000);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(instance.setAuthCalls).toBe(2);
		expect(instance.closed).toBe(true);
	});

	test("exchanges the session token same-origin and returns the jwt", async () => {
		const postSpy = spy_on_post_message();
		await connect_client();
		const { fetchMock, exchangeCalls } = stub_exchange([jwt_response("jwt_1", Date.now() + 1_800_000)]);

		await expect(convex_instance().fetchToken!()).resolves.toBe("jwt_1");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.test/plugins-ui/session-jwt",
			expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
		);
		expect(exchangeCalls).toEqual([{ token: "plu_1" }]);
		// The init token was fresh, so no host refresh was needed on the way.
		expect(refresh_requests(postSpy)).toHaveLength(0);
	});

	test("the exchange's sessionExpiresAt re-anchors the refresh margin", async () => {
		const postSpy = spy_on_post_message();
		const client = await connect_client();
		// The exchange reports the session ending sooner than the init said.
		stub_exchange([jwt_response("jwt_1", Date.now() + 30_000)]);
		await expect(convex_instance().fetchToken!()).resolves.toBe("jwt_1");

		// getToken now sees the session inside the 60-second margin and asks the host.
		const tokenPromise = client.getToken();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");
		await expect(tokenPromise).resolves.toBe("plu_2");
	});

	test("a session near expiry is refreshed through the host before the exchange", async () => {
		const postSpy = spy_on_post_message();
		spy_on_post_message();
		const clientPromise = bonobo_connect();
		// The init token is already inside the 60-second refresh margin.
		post_from_host(make_init({ tokenExpiresAt: Date.now() + 30_000 }));
		await clientPromise;
		const { exchangeCalls } = stub_exchange((body) => jwt_response(`jwt_for_${body.token}`, Date.now() + 1_800_000));

		const jwtPromise = convex_instance().fetchToken!();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		// The host refresh extended the session, and the exchange used the fresh token.
		await expect(jwtPromise).resolves.toBe("jwt_for_plu_2");
		expect(exchangeCalls).toEqual([{ token: "plu_2" }]);
	});

	test("a 401 exchange refreshes the session once and re-exchanges", async () => {
		const postSpy = spy_on_post_message();
		await connect_client();
		const { exchangeCalls } = stub_exchange([
			new Response("dead", { status: 401 }),
			jwt_response("jwt_2", Date.now() + 1_800_000),
		]);

		const jwtPromise = convex_instance().fetchToken!();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		await expect(jwtPromise).resolves.toBe("jwt_2");
		expect(exchangeCalls).toEqual([{ token: "plu_1" }, { token: "plu_2" }]);
	});

	test("a second 401 answers null: the session is gone", async () => {
		const postSpy = spy_on_post_message();
		await connect_client();
		stub_exchange([new Response("dead", { status: 401 }), new Response("dead", { status: 401 })]);

		const jwtPromise = convex_instance().fetchToken!();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		await expect(jwtPromise).resolves.toBeNull();
	});

	test("a transient exchange failure retries instead of reporting unauthenticated", async () => {
		await connect_client();
		// One null from fetchToken is final for the Convex client, so a 429 or a network blip
		// must be retried, not reported as "unauthenticated".
		const { exchangeCalls } = stub_exchange([
			new Response("slow down", { status: 429 }),
			jwt_response("jwt_retry", Date.now() + 1_800_000),
		]);

		await expect(convex_instance().fetchToken!()).resolves.toBe("jwt_retry");
		expect(exchangeCalls).toEqual([{ token: "plu_1" }, { token: "plu_1" }]);
	}, 15_000);

	test("a hard refusal answers null without retrying", async () => {
		await connect_client();
		const { fetchMock } = stub_exchange([new Response("refused", { status: 403 })]);

		await expect(convex_instance().fetchToken!()).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	test("a refused host refresh answers null", async () => {
		const postSpy = spy_on_post_message();
		await connect_client();
		stub_exchange([new Response("dead", { status: 401 })]);

		const jwtPromise = convex_instance().fetchToken!();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		const request = refresh_requests(postSpy)[0]?.[0] as { requestId: string };
		post_from_host({
			type: "bonobo:token-error",
			nonce: NONCE,
			requestId: request.requestId,
			message: "Session revoked",
		});

		await expect(jwtPromise).resolves.toBeNull();
	});

	test("a rate-limited or malformed exchange answers null", async () => {
		await connect_client();

		stub_exchange([new Response(JSON.stringify({ message: "Rate limit exceeded" }), { status: 429 })]);
		await expect(convex_instance().fetchToken!()).resolves.toBeNull();

		stub_exchange([
			new Response(JSON.stringify({ _yay: { jwt: 42, sessionExpiresAt: "soon" } }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		]);
		await expect(convex_instance().fetchToken!()).resolves.toBeNull();
	});
});

describe("convex session jwt delivered by the host", () => {
	const JWT_LIFETIME_MS = 1_800_000;

	async function connect_with_jwt(overrides?: Record<string, unknown>) {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init({ jwt: "jwt_1", jwtExpiresAt: Date.now() + JWT_LIFETIME_MS, ...overrides }));
		return { client: await clientPromise, postSpy };
	}

	// A delivered JWT must never be exchanged, so any fetch is a failure.
	function refuse_exchange() {
		const fetchMock = vi.fn((url: string): Promise<Response> => {
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	function answer_error(postSpy: ReturnType<typeof spy_on_post_message>, index: number) {
		const request = refresh_requests(postSpy)[index]?.[0] as { requestId: string } | undefined;
		if (!request) {
			throw new Error("refresh request not posted");
		}
		post_from_host({
			type: "bonobo:token-error",
			nonce: NONCE,
			requestId: request.requestId,
			message: "Session revoked",
		});
	}

	test("hands the delivered JWT to the Convex client without an exchange request", async () => {
		const { postSpy } = await connect_with_jwt();
		const fetchMock = refuse_exchange();

		// The client's startup fetch is not forced.
		await expect(convex_instance().fetchToken!({ forceRefreshToken: false })).resolves.toBe("jwt_1");
		expect(fetchMock).not.toHaveBeenCalled();
		expect(refresh_requests(postSpy)).toHaveLength(0);
	});

	test("a forced refetch for the JWT Convex holds refreshes once through the host and returns the new JWT", async () => {
		const { postSpy } = await connect_with_jwt();
		const fetchMock = refuse_exchange();
		const fetchToken = convex_instance().fetchToken!;
		await expect(fetchToken({ forceRefreshToken: false })).resolves.toBe("jwt_1");

		// Convex refused jwt_1 (or its expiry timer fired): it asks for a newer token.
		const jwtPromise = fetchToken({ forceRefreshToken: true });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2", { jwt: "jwt_2", jwtExpiresAt: Date.now() + JWT_LIFETIME_MS });

		await expect(jwtPromise).resolves.toBe("jwt_2");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("a forced refetch after a REST rotation still refreshes through the host so Convex holds a JWT issued now", async () => {
		const { client, postSpy } = await connect_with_jwt();
		refuse_exchange();
		const fetchToken = convex_instance().fetchToken!;
		await expect(fetchToken({ forceRefreshToken: false })).resolves.toBe("jwt_1");

		// A 401 on a REST call already rotated the pair.
		const tokenPromise = client.refreshToken();
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2", { jwt: "jwt_2", jwtExpiresAt: Date.now() + JWT_LIFETIME_MS });
		await expect(tokenPromise).resolves.toBe("plu_2");

		// The Convex client schedules its next ask from the delivered JWT's `exp - iat`, as if it were
		// issued at that moment. Handing it the stored jwt_2 (issued earlier) would push that ask past
		// the real session end, so a forced ask always rotates again.
		const jwtPromise = fetchToken({ forceRefreshToken: true });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(2));
		answer_refresh(postSpy, "plu_3", { jwt: "jwt_3", jwtExpiresAt: Date.now() + JWT_LIFETIME_MS });
		await expect(jwtPromise).resolves.toBe("jwt_3");
	});

	test("a JWT of the wrong type counts as not delivered, so the exchange fallback runs", async () => {
		const { postSpy } = await connect_with_jwt({ jwt: 123 });
		const exchangeCalls: { token: string }[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((_url: string, init: { body: string }) => {
				exchangeCalls.push(JSON.parse(init.body) as { token: string });
				return Promise.resolve(
					new Response(
						JSON.stringify({ _yay: { jwt: "jwt_exchanged", sessionExpiresAt: Date.now() + JWT_LIFETIME_MS } }),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					),
				);
			}),
		);

		await expect(convex_instance().fetchToken!({ forceRefreshToken: false })).resolves.toBe("jwt_exchanged");
		expect(exchangeCalls).toEqual([{ token: "plu_1" }]);
		expect(refresh_requests(postSpy)).toHaveLength(0);
	});

	test("a delivered JWT inside the margin refreshes through the host before it is handed out", async () => {
		const { postSpy } = await connect_with_jwt({
			tokenExpiresAt: Date.now() + 30_000,
			jwtExpiresAt: Date.now() + 30_000,
		});
		const fetchMock = refuse_exchange();

		const jwtPromise = convex_instance().fetchToken!({ forceRefreshToken: false });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2", { jwt: "jwt_2", jwtExpiresAt: Date.now() + JWT_LIFETIME_MS });

		await expect(jwtPromise).resolves.toBe("jwt_2");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("a refresh answered without a JWT falls back to exchanging the refreshed token", async () => {
		const { postSpy } = await connect_with_jwt({
			tokenExpiresAt: Date.now() + 30_000,
			jwtExpiresAt: Date.now() + 30_000,
		});
		const exchangeCalls: { token: string }[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn((_url: string, init: { body: string }) => {
				exchangeCalls.push(JSON.parse(init.body) as { token: string });
				return Promise.resolve(
					new Response(
						JSON.stringify({ _yay: { jwt: "jwt_exchanged", sessionExpiresAt: Date.now() + JWT_LIFETIME_MS } }),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					),
				);
			}),
		);

		const jwtPromise = convex_instance().fetchToken!({ forceRefreshToken: false });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		// An older host answers the token only.
		answer_refresh(postSpy, "plu_2");

		await expect(jwtPromise).resolves.toBe("jwt_exchanged");
		expect(exchangeCalls).toEqual([{ token: "plu_2" }]);
	});

	test("a host that keeps refusing the refresh answers null after the transient retries", async () => {
		const { postSpy } = await connect_with_jwt({
			tokenExpiresAt: Date.now() + 30_000,
			jwtExpiresAt: Date.now() + 30_000,
		});
		const fetchMock = refuse_exchange();

		const jwtPromise = convex_instance().fetchToken!({ forceRefreshToken: false });
		for (let index = 0; index < 3; index += 1) {
			await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(index + 1), { timeout: 5_000 });
			answer_error(postSpy, index);
		}

		await expect(jwtPromise).resolves.toBeNull();
		expect(fetchMock).not.toHaveBeenCalled();
	}, 15_000);
});

describe("client.session", () => {
	test("expiresAt follows the token expiry the host sent last", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_connect();
		const initExpiresAt = Date.now() + 600_000;
		post_from_host(make_init({ tokenExpiresAt: initExpiresAt }));
		const client = await clientPromise;
		expect(client.session.expiresAt()).toBe(initExpiresAt);

		// A host refresh rotates the token and moves the expiry with it.
		const refreshed = client.refreshToken();
		const rotatedExpiresAt = initExpiresAt + 1_800_000;
		answer_refresh(postSpy, "plu_2", { tokenExpiresAt: rotatedExpiresAt });
		await expect(refreshed).resolves.toBe("plu_2");
		expect(client.session.expiresAt()).toBe(rotatedExpiresAt);
	});

	test("the exchange moves expiresAt to the session end the server reported", async () => {
		const client = await connect_client();
		const sessionExpiresAt = Date.now() + 1_200_000;
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ _yay: { jwt: "jwt_1", sessionExpiresAt } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		await expect(client.session.fetchJwt()).resolves.toBe("jwt_1");
		expect(client.session.expiresAt()).toBe(sessionExpiresAt);
	});

	test("fetchJwt is the auth callback the Convex client received", async () => {
		const client = await connect_client();
		expect(client.session.fetchJwt).toBe(convex_instance().fetchToken);
	});
});

describe("client.theme", () => {
	// A slice of the app's scales, under the names the host really sends. The full set is 104
	// entries; the SDK writes whatever arrives, so a few are enough here.
	const HOST_THEME = {
		mode: "dark",
		tokens: {
			"--color-base-1-01": "oklch(0.14 0.001 85)",
			"--color-base-1-03": "oklch(0.2 0.004 85)",
			"--color-fg-12": "oklch(0.95 0.01 81)",
			"--color-accent-05": "oklch(0.617 0.15 52)",
			"--color-red-09": "oklch(0.65 0.2 29.2)",
		},
	};

	afterEach(() => {
		// The SDK paints onto the document, so a theme one test applied must not reach the next.
		document.documentElement.removeAttribute("style");
		document.documentElement.classList.remove("light", "dark");
	});

	test("carries the host theme from init and replaces it on every later switch", async () => {
		spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init({ theme: HOST_THEME }));
		const client = await clientPromise;

		// A plugin frame is its own document and inherits none of the host's custom properties, so
		// the finished values have to arrive over the bridge.
		expect(client.theme.current()).toEqual(HOST_THEME);
		// And the SDK paints them onto the document itself, under the app's own names and with the
		// app's own theme class, so a plugin stylesheet can use `var(--color-base-1-03)` and
		// `.dark &` exactly as the app does without any plugin code in between.
		const root = document.documentElement;
		expect(root.style.getPropertyValue("--color-base-1-01")).toBe("oklch(0.14 0.001 85)");
		expect(root.style.getPropertyValue("--color-red-09")).toBe("oklch(0.65 0.2 29.2)");
		expect(root.classList.contains("dark")).toBe(true);
		expect(root.classList.contains("light")).toBe(false);

		const onChange = vi.fn();
		const unsubscribe = client.theme.subscribe(onChange);
		// Subscribing never replays the theme the page already read.
		expect(onChange).not.toHaveBeenCalled();

		const lightTheme = {
			mode: "light",
			tokens: { ...HOST_THEME.tokens, "--color-base-1-01": "oklch(0.99 0 0)" },
		};
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: lightTheme });
		expect(onChange).toHaveBeenNthCalledWith(1, lightTheme);
		expect(client.theme.current()).toEqual(lightTheme);
		// A switch repaints the document the same way, and swaps the class instead of stacking a
		// second one.
		expect(root.style.getPropertyValue("--color-base-1-01")).toBe("oklch(0.99 0 0)");
		expect(root.classList.contains("light")).toBe(true);
		expect(root.classList.contains("dark")).toBe(false);

		unsubscribe();
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: HOST_THEME });
		expect(onChange).toHaveBeenCalledTimes(1);
		// The store keeps following the host after the last subscriber left, so a page that only
		// reads current() on demand still sees the theme the member is in.
		expect(client.theme.current()).toEqual(HOST_THEME);
		expect(root.classList.contains("dark")).toBe(true);
	});

	test("keeps the last good theme when the host sends something else", async () => {
		spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init({ theme: HOST_THEME }));
		const client = await clientPromise;
		const onChange = vi.fn();
		client.theme.subscribe(onChange);

		// Every field crosses an origin boundary, so a message that fails the check is dropped
		// whole. Half a theme would paint a page with one wrong colour and no way to notice. One
		// message per reject branch: not an object, a bad mode, tokens not an object, a token that
		// is not a string.
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: "light" });
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: { mode: "dusk", tokens: {} } });
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: { mode: "light", tokens: null } });
		post_from_host({
			type: "bonobo:theme",
			nonce: NONCE,
			theme: { mode: "light", tokens: { "--color-fg-12": 7 } },
		});
		// The nonce is what proves the message came from this frame's host.
		post_from_host({ type: "bonobo:theme", nonce: "other-nonce", theme: { mode: "light", tokens: {} } });

		expect(onChange).not.toHaveBeenCalled();
		expect(client.theme.current()).toEqual(HOST_THEME);
		// Nothing reached the document either: the dropped light themes left the dark class alone,
		// and the `7` was never written over the real value.
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
		expect(document.documentElement.style.getPropertyValue("--color-fg-12")).toBe("oklch(0.95 0.01 81)");
	});

	test("accepts an empty token map and then only switches the class", async () => {
		spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init({ theme: HOST_THEME }));
		const client = await clientPromise;

		// An empty map is a well-formed theme, not a malformed one. The SDK writes what arrives and
		// removes nothing, so the properties from init stay on the root.
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: { mode: "light", tokens: {} } });
		expect(client.theme.current()).toEqual({ mode: "light", tokens: {} });
		expect(document.documentElement.classList.contains("light")).toBe(true);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
		expect(document.documentElement.style.getPropertyValue("--color-base-1-01")).toBe("oklch(0.14 0.001 85)");
	});

	test("stays null when the host sends no theme at all", async () => {
		// The page must be able to tell "no theme" apart from a theme, so it can keep its own colours
		// instead of reading empty strings. The document is left alone too.
		const client = await connect_client();
		expect(client.theme.current()).toBeNull();
		expect(document.documentElement.getAttribute("style")).toBeNull();
		expect(document.documentElement.className).toBe("");
	});

	test("stays null when the theme inside init is malformed", async () => {
		// The same whole-message rule as later switches: a bad init theme is dropped, not half applied.
		spy_on_post_message();
		const clientPromise = bonobo_connect();
		post_from_host(make_init({ theme: { mode: "dark", tokens: "not a map" } }));
		const client = await clientPromise;
		expect(client.theme.current()).toBeNull();
		expect(document.documentElement.getAttribute("style")).toBeNull();
		expect(document.documentElement.className).toBe("");
	});
});
