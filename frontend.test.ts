import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bonobo_ui_connect } from "./frontend.js";

const HOST_ORIGIN = "https://host.test";
const NONCE = "0f8fad5b-d9cb-469f-a165-70867728950e";
const CONVEX_URL = "https://deployment.convex.test";

type FakeOnUpdateEntry = {
	query: unknown;
	args: Record<string, unknown>;
	callback: (value: unknown) => void;
	onError: (error: Error) => void;
	unsubscribed: boolean;
};

type FakeConvexClientInstance = {
	address: string;
	options: Record<string, unknown>;
	fetchToken: (() => Promise<string | null>) | null;
	setAuthCalls: number;
	closed: boolean;
	onUpdates: FakeOnUpdateEntry[];
	onUpdate: (
		query: unknown,
		args: Record<string, unknown>,
		callback: (value: unknown) => void,
		onError: (error: Error) => void,
	) => () => void;
	mutation: ReturnType<typeof vi.fn>;
	query: ReturnType<typeof vi.fn>;
};

const fakeConvex = vi.hoisted(() => ({
	instances: [] as unknown[],
}));

// The real client opens a WebSocket at construction, so every client-backed test runs against
// this fake. Its onUpdate records the registration and lets the test deliver results manually —
// always after registration returned, which reproduces the real client's async delivery.
vi.mock("convex/browser", () => ({
	ConvexClient: class FakeConvexClient {
		address: string;
		options: Record<string, unknown>;
		fetchToken: (() => Promise<string | null>) | null = null;
		setAuthCalls = 0;
		closed = false;
		onUpdates: FakeOnUpdateEntry[] = [];
		mutation = vi.fn();
		query = vi.fn();
		constructor(address: string, options: Record<string, unknown>) {
			this.address = address;
			this.options = options;
			fakeConvex.instances.push(this);
		}
		setAuth(fetchToken: () => Promise<string | null>) {
			this.fetchToken = fetchToken;
			this.setAuthCalls += 1;
		}
		onUpdate(
			query: unknown,
			args: Record<string, unknown>,
			callback: (value: unknown) => void,
			onError: (error: Error) => void,
		) {
			const entry: FakeOnUpdateEntry = { query, args, callback, onError, unsubscribed: false };
			this.onUpdates.push(entry);
			return () => {
				entry.unsubscribed = true;
			};
		}
		close() {
			this.closed = true;
		}
	},
}));

function convex_instance() {
	const instance = fakeConvex.instances.at(-1) as FakeConvexClientInstance | undefined;
	if (!instance) {
		throw new Error("ConvexClient not constructed");
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

function make_public_doc(overrides?: Record<string, unknown>) {
	return {
		collection: "messages",
		key: "m:1",
		value: { body: "hi" },
		revision: 1,
		createdBy: "user_1",
		updatedBy: "user_1",
		ownership: "shared",
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	};
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

/**
 * One macrotask: flushes the SDK's setTimeout(0) death deliveries and the window flush.
 */
async function flush_deliveries() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

async function connect_client() {
	spy_on_post_message();
	const clientPromise = bonobo_ui_connect();
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

describe("bonobo_ui_connect", () => {
	test("rejects a missing or malformed host bridge fragment", async () => {
		window.history.replaceState(null, "", "/");
		await expect(bonobo_ui_connect()).rejects.toThrow("Missing host bridge fragment");

		// A plugin that ships only file views renders this rejection verbatim to the member (the
		// video player's `main.tsx` does exactly that). A member in a file view is not on a page,
		// so the wording must name the frame instead. Pin the rule, not the sentence: re-wording
		// is fine, calling the frame a page is not.
		let bridgeMessage = "";
		await bonobo_ui_connect().catch((error: unknown) => {
			bridgeMessage = error instanceof Error ? error.message : String(error);
		});
		expect(bridgeMessage).not.toMatch(/page/i);

		set_bridge_fragment("ftp://host.test");
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge parent origin");

		set_bridge_fragment("https://host.test/");
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge parent origin");

		set_bridge_fragment(HOST_ORIGIN, "not-a-uuid");
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge nonce");

		window.history.replaceState(
			null,
			"",
			`/#${new URLSearchParams({ parentOrigin: HOST_ORIGIN, nonce: NONCE, extra: "value" })}`,
		);
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge fragment");
	});

	test("sends nonce-bound ready to the exact parent and accepts only its matching init", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
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
		expect(instance.options).toEqual({ expectAuth: true, unsavedChangesWarning: false });
		expect(instance.fetchToken).toBeTypeOf("function");
		expect(instance.closed).toBe(false);

		window.dispatchEvent(new Event("pagehide"));
		expect(instance.closed).toBe(true);
	});

	test("accepts a file-view context and rejects contexts with a missing or unknown kind", async () => {
		spy_on_post_message();
		const clientPromise = bonobo_ui_connect();

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
		const clientPromise = bonobo_ui_connect();

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
		const clientPromise = bonobo_ui_connect();

		await vi.advanceTimersByTimeAsync(15_500);
		expect(
			postSpy.mock.calls.filter((call) => (call[0] as { type?: string }).type === "bonobo:ready").length,
		).toBeGreaterThan(20);

		post_from_host(make_init());
		await expect(clientPromise).resolves.toMatchObject({ apiOrigin: "https://api.test" });
	});

	test("shares one token refresh across simultaneous 401 responses", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
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

		const first = client.fetchJson("/api/v1/files/list", { body: { limit: 100 } });
		const second = client.fetchJson("/api/v1/files/list", { body: { limit: 100 } });
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(fetchMock.mock.calls[0]?.[1].headers.get("Authorization")).toBe("Bearer plu_1");
		expect(fetchMock.mock.calls[2]?.[1].headers.get("Authorization")).toBe("Bearer plu_2");
	});

	test("a delayed 401 retries the token another request already refreshed", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		let resolveDelayed401: ((response: Response) => void) | null = null;
		const delayed401 = new Promise<Response>((resolve) => {
			resolveDelayed401 = resolve;
		});
		const fetchMock = vi.fn((url: string, init: { headers: Headers }): Promise<Response> => {
			const bearer = init.headers.get("Authorization");
			if (url.endsWith("/first") && bearer === "Bearer plu_1") {
				return Promise.resolve(new Response("expired", { status: 401 }));
			}
			if (url.endsWith("/second") && bearer === "Bearer plu_1") {
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

		const first = client.fetchJson("/first");
		const second = client.fetchJson("/second");
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");
		await expect(first).resolves.toEqual({ bearer: "Bearer plu_2" });

		resolveDelayed401?.(new Response("late expired", { status: 401 }));
		await expect(second).resolves.toEqual({ bearer: "Bearer plu_2" });
		expect(refresh_requests(postSpy)).toHaveLength(1);
	});

	test("throws after the one 401 retry instead of starting another cycle", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;
		const fetchMock = vi.fn().mockResolvedValue(new Response("still expired", { status: 401 }));
		vi.stubGlobal("fetch", fetchMock);

		const result = client.fetchJson("/api/v1/files/list");
		await vi.waitFor(() => expect(refresh_requests(postSpy)).toHaveLength(1));
		answer_refresh(postSpy, "plu_2");

		await expect(result).rejects.toMatchObject({ status: 401, responseText: "still expired" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(refresh_requests(postSpy)).toHaveLength(1);
	});

	test("shares refresh failure and lets a later request try again", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
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
		const clientPromise = bonobo_ui_connect();
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
		const clientPromise = bonobo_ui_connect();
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

	test("declares the fetchJson result as unknown so a page must check the answer before reading it", async () => {
		// `fetchJson` is the one call that hands the page data from outside the app, and outside data
		// starts as `unknown`. With `any` a page could read `.items` off a listing page that came back
		// empty while `isDone` was still false, which is exactly what the doc block warns about.
		//
		// This reads the declaration text because nothing in this package type-checks that file:
		// `pnpm run typecheck` passes `--skipLibCheck`, which skips every `.d.ts`, and vitest
		// transpiles the tests without checking types. A type-level assertion here would never run.
		//
		// Build the path from `import.meta.dirname`, not from `new URL(..., import.meta.url)`. The
		// happy-dom environment resolves a relative URL against the fake document location, so that
		// form asks for `https://plugin.test/frontend.d.ts` and `readFile` refuses the scheme.
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		// Cut the declaration out first, from `fetchJson(` to the `Promise<…>;` that ends it, so a
		// failure prints the signature instead of the whole file.
		const fetchJsonDeclaration = declaration.match(/\bfetchJson\([^]*?\bPromise<[^>]*>;/)?.[0] ?? "";
		expect(fetchJsonDeclaration).toMatch(/\): Promise<unknown>;$/);

		// Read the implementation's own JSDoc too. It is the file a maintainer opens to edit
		// `fetchJson`, and `any` is assignable to `unknown`, so the two can disagree forever without
		// a compile error. Someone reading only `frontend.js` would "fix" the declaration back.
		const implementation = await readFile(join(import.meta.dirname, "frontend.js"), "utf8");
		// Anchor on the block close so this reads fetchJson's own tag. Without the anchor the scan
		// returns the first `@returns` in the file that has `fetchJson` somewhere after it.
		const fetchJsonReturnsTag =
			implementation.match(/@returns \{Promise<[^>]*>\}(?=\s*\*\/\s*async function fetchJson\()/)?.[0] ?? "";
		expect(fetchJsonReturnsTag).toBe("@returns {Promise<unknown>}");

		// The README states the same rule and then shows the one example a plugin author copies.
		// That example used to read `page.items`, `page.cursor`, `page.isDone` and `error.status`
		// with no check at all, so it broke the rule printed above it and did not compile in a
		// TypeScript plugin — which every first-party plugin is. Read the file the same way,
		// because no gate in this package looks at the README.
		const readme = await readFile(join(import.meta.dirname, "README.md"), "utf8");
		// Cut out just the frontend example's fenced block, so a failure prints the snippet.
		const frontendExample = readme.match(/### Frontend page example\s*```js\n([^]*?)```/)?.[1] ?? "";
		expect(frontendExample).toContain("client.fetchJson");

		// Both guards must survive, in the shape the shipped plugins already use: the video
		// player's `get_error_status` before reading a rejection's `status`, and Council's
		// `as_record` before reading fields off the answer.
		expect(frontendExample).toContain('"status" in error');
		expect(frontendExample).toContain('typeof page === "object" && page !== null');
		// And nothing may read a field straight off the `unknown` that `fetchJson` answered.
		expect(frontendExample).not.toMatch(/\bpage\.\w/);
	});
});

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
		const clientPromise = bonobo_ui_connect();
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

describe("data.watch", () => {
	test("subscribes on the page's client and delivers each update's docs", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watch({ collection: "messages", keyPrefix: "m:", limit: 100 }, onUpdate);
		const instance = convex_instance();
		expect(instance.onUpdates).toHaveLength(1);
		const registration = instance.onUpdates[0]!;
		expect(getFunctionName(registration.query as never)).toBe("plugins_data:watch_documents");
		expect(registration.args).toEqual({ collection: "messages", keyPrefix: "m:", limit: 100 });

		const firstDocs = [make_public_doc()];
		registration.callback({ docs: firstDocs, truncated: false });
		const secondDocs = [make_public_doc(), make_public_doc({ key: "m:2" })];
		registration.callback({ docs: secondDocs, truncated: false });

		expect(onUpdate).toHaveBeenNthCalledWith(1, { docs: firstDocs, truncated: false });
		expect(onUpdate).toHaveBeenNthCalledWith(2, { docs: secondDocs, truncated: false });
	});

	test("a capped read reports truncated so a page can tell a full list from a first page", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watch({ collection: "messages", keyPrefix: "m:", limit: 100 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;

		// The collection holds 101 documents and the read is capped at 100, so the store answers a
		// full page and says so. A plain watch cannot reach the 101st at all, and without this flag
		// the page would show 100 documents with nothing to say one is missing.
		const cappedPage = Array.from({ length: 100 }, (_, index) => make_public_doc({ key: `m:${index}` }));
		registration.callback({ docs: cappedPage, truncated: true });

		expect(onUpdate).toHaveBeenNthCalledWith(1, { docs: cappedPage, truncated: true });
	});

	test("declares the watch update as a payload object so a page is handed truncated", async () => {
		// The test above proves the runtime hands over `{ docs, truncated }`. Nothing proves the
		// declaration says so, and the declaration is what a plugin author writes code against.
		// `pnpm run typecheck` passes `--skipLibCheck`, which skips every `.d.ts`, and vitest
		// transpiles the tests without checking types — so both named gates pass while
		// `frontend.js` and `frontend.d.ts` disagree. Read the declaration text, like the
		// `fetchJson` test above does for the same reason.
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		// Cut the declaration out first so a failure prints the signature, not the whole file.
		// Anchor on the line start: `watchWindow(` would otherwise be a second match.
		const watchDeclaration = declaration.match(/^\t\twatch\([^]*?\): \(\) => void;/m)?.[0] ?? "";
		expect(watchDeclaration).toContain(
			"onUpdate: (update: BonoboUiDataWatchUpdate | null, info?: BonoboUiWatchDeathInfo) => void,",
		);
		expect(declaration).toContain("at most 100 server subscriptions");

		// The callback type is only worth as much as the interface behind it.
		const watchUpdateInterface = declaration.match(/export interface BonoboUiDataWatchUpdate \{[^]*?\n\}/)?.[0] ?? "";
		expect(watchUpdateInterface).toContain("truncated: boolean;");

		// `reason` is a plain string in the type, so the documentation is the only place a plugin
		// author learns which values to switch on. A reason the SDK sends and the doc omits is a
		// branch nobody writes.
		const deathDoc = declaration.match(/\/\*\*[^]*?\*\/\nexport interface BonoboUiWatchDeathInfo/)?.[0] ?? "";
		for (const reason of ["invalid", "capacity", "denied", "session_expired", "unavailable"]) {
			expect(deathDoc).toContain(`\`"${reason}"\``);
		}
	});

	test("a null answer kills the subscription as denied and makes unsubscribe a no-op", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		const unsubscribe = client.data.watch({ collection: "messages", limit: 50 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;
		expect("keyPrefix" in registration.args).toBe(false);

		// null is the store's one answer for every refusal, so this is the reason a page shows when
		// the plugin was uninstalled or its data removed. Telling the member to sign in again here
		// would be advice that cannot help.
		registration.callback(null);
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "denied",
			message: "This plugin no longer has access to its data",
		});
		expect(registration.unsubscribed).toBe(true);

		// Late deliveries for the dead registration are dropped, and unsubscribe is inert.
		registration.callback({ docs: [make_public_doc()], truncated: false });
		unsubscribe();
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	test("a query error on a live session is the connection, and it is logged", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watch({ collection: "messages", limit: 10 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;

		registration.onError(new Error("query failed"));
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "unavailable",
			message: "The plugin data connection is unavailable",
		});
		expect(registration.unsubscribed).toBe(true);
		expect(errorSpy).toHaveBeenCalled();
	});

	test("the same query error after the session ran out is session_expired, and stays out of the log", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		// The frame's session is already past its end. The server answers a page read the same
		// opaque way whether the session lapsed or the connection broke, so the SDK's own clock is
		// the whole difference — and the two deserve different advice: reload, or wait.
		post_from_host(make_init({ tokenExpiresAt: Date.now() - 1_000 }));
		const client = await clientPromise;

		const onUpdate = vi.fn();
		client.data.watch({ collection: "messages", limit: 10 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;

		registration.onError(new Error("query failed"));
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "session_expired",
			message: "This plugin session expired",
		});
		// An ordinary end of a frame's life is not a fault, so it writes no error line.
		expect(errorSpy).not.toHaveBeenCalled();
	});

	test("unsubscribe disposes once and stops delivery", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		const unsubscribe = client.data.watch({ collection: "messages", limit: 100 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;

		unsubscribe();
		expect(registration.unsubscribed).toBe(true);

		registration.callback({ docs: [make_public_doc()], truncated: false });
		expect(onUpdate).not.toHaveBeenCalled();
		unsubscribe();
	});

	test("invalid inputs die at birth with a reason and never reach the client", async () => {
		const client = await connect_client();

		const cases: Array<[{ collection: string; keyPrefix?: string; limit: number }, string]> = [
			[{ collection: "", limit: 10 }, "Collection names must be 1 to 128 characters"],
			[{ collection: "a".repeat(129), limit: 10 }, "Collection names must be 1 to 128 characters"],
			[
				{ collection: "messages", keyPrefix: "no space", limit: 10 },
				"Key prefixes must be 1 to 109 printable ASCII characters",
			],
			[{ collection: "messages", limit: 0 }, "Watch limits must be integers from 1 to 100"],
			[{ collection: "messages", limit: 101 }, "Watch limits must be integers from 1 to 100"],
			[{ collection: "messages", limit: 2.5 }, "Watch limits must be integers from 1 to 100"],
		];
		for (const [opts, message] of cases) {
			const onUpdate = vi.fn();
			client.data.watch(opts, onUpdate);
			expect(onUpdate).not.toHaveBeenCalled();
			await flush_deliveries();
			expect(onUpdate).toHaveBeenNthCalledWith(1, null, { reason: "invalid", message });
		}
		expect(convex_instance().onUpdates).toHaveLength(0);

		// Inputs outside the client-side subset — refusals whose outcome depends on the Unicode
		// version — still go to the server and die as its bare null.
		client.data.watch({ collection: "bad\u{0}name", limit: 10 }, vi.fn());
		expect(convex_instance().onUpdates).toHaveLength(1);
	});

	test("the seventeenth watch dies as capacity without subscribing", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const client = await connect_client();

		for (let index = 1; index <= 16; index += 1) {
			client.data.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		expect(convex_instance().onUpdates).toHaveLength(16);

		const onRefused = vi.fn();
		client.data.watch({ collection: "notes", limit: 10 }, onRefused);
		await flush_deliveries();
		expect(convex_instance().onUpdates).toHaveLength(16);
		// The cap refusal names itself: a page holding real slots should close one, not treat
		// the refusal as access gone.
		expect(onRefused).toHaveBeenNthCalledWith(1, null, {
			reason: "capacity",
			message: "Subscription limit reached for this plugin frame",
		});
		expect(warnSpy).toHaveBeenCalled();

		// A death released its slot: after one subscription dies, a new watch starts again.
		convex_instance().onUpdates[0]!.callback(null);
		client.data.watch({ collection: "notes", limit: 10 }, vi.fn());
		expect(convex_instance().onUpdates).toHaveLength(17);
	});
});

describe("data.watchRecent", () => {
	test("subscribes on watch_recent, passes the fenceposts through, and delivers each update", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watchRecent(
			{ collection: "messages", limit: 100, order: "desc", before: 1_700_000_000_000, scopeId: "scope-1" },
			onUpdate,
		);
		const instance = convex_instance();
		expect(instance.onUpdates).toHaveLength(1);
		const registration = instance.onUpdates[0]!;
		expect(getFunctionName(registration.query as never)).toBe("plugins_data:watch_recent");
		expect(registration.args).toEqual({
			collection: "messages",
			limit: 100,
			order: "desc",
			before: 1_700_000_000_000,
			scopeId: "scope-1",
		});

		const firstDocs = [make_public_doc()];
		registration.callback({ docs: firstDocs, truncated: false });
		const secondDocs = [make_public_doc(), make_public_doc({ key: "m:2" })];
		registration.callback({ docs: secondDocs, truncated: true });

		expect(onUpdate).toHaveBeenNthCalledWith(1, { docs: firstDocs, truncated: false });
		expect(onUpdate).toHaveBeenNthCalledWith(2, { docs: secondDocs, truncated: true });
	});

	test("omitted options are dropped, not forwarded as undefined", async () => {
		const client = await connect_client();

		client.data.watchRecent({ collection: "messages", limit: 50 }, vi.fn());
		const registration = convex_instance().onUpdates[0]!;
		expect(registration.args).toEqual({ collection: "messages", limit: 50 });
		expect("order" in registration.args).toBe(false);
		expect("since" in registration.args).toBe(false);
		expect("before" in registration.args).toBe(false);
		expect("scopeId" in registration.args).toBe(false);
	});

	test("a null answer kills the subscription with the same death contract as watch", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		const unsubscribe = client.data.watchRecent({ collection: "messages", limit: 50 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;

		// The server answers a bare null for a refused read AND for a mispaired fencepost, like
		// `since` with `"desc"`, so this branch is also what a direction violation hears.
		registration.callback(null);
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "denied",
			message: "This plugin no longer has access to its data",
		});
		expect(registration.unsubscribed).toBe(true);

		// Late deliveries for the dead registration are dropped, and unsubscribe is inert.
		registration.callback({ docs: [make_public_doc()], truncated: false });
		unsubscribe();
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	test("an out-of-range limit dies at birth and never reaches the client", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watchRecent({ collection: "messages", limit: 0 }, onUpdate);
		expect(onUpdate).not.toHaveBeenCalled();
		await flush_deliveries();
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "invalid",
			message: "Watch limits must be integers from 1 to 100",
		});
		expect(convex_instance().onUpdates).toHaveLength(0);
	});

	test("recent watches share the page's sixteen slots and release them on death", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const client = await connect_client();

		for (let index = 1; index <= 15; index += 1) {
			client.data.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		client.data.watchRecent({ collection: "messages", limit: 10 }, vi.fn());
		expect(convex_instance().onUpdates).toHaveLength(16);

		const onRefused = vi.fn();
		client.data.watchRecent({ collection: "messages", limit: 10 }, onRefused);
		await flush_deliveries();
		expect(convex_instance().onUpdates).toHaveLength(16);
		expect(onRefused).toHaveBeenNthCalledWith(1, null, {
			reason: "capacity",
			message: "Subscription limit reached for this plugin frame",
		});
		expect(warnSpy).toHaveBeenCalled();

		// The dead recent watch returns its slot: after the sixteenth dies, a plain watch starts.
		convex_instance().onUpdates[15]!.callback(null);
		client.data.watch({ collection: "notes", limit: 10 }, vi.fn());
		expect(convex_instance().onUpdates).toHaveLength(17);
	});
});

describe("data.watchChanges", () => {
	test("subscribes on watch_changes, passes the fencepost through, and delivers each update", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watchChanges(
			{ collection: "messages", limit: 100, updatedSince: 1_700_000_000_000, scopeId: "scope-1" },
			onUpdate,
		);
		const instance = convex_instance();
		expect(instance.onUpdates).toHaveLength(1);
		const registration = instance.onUpdates[0]!;
		expect(getFunctionName(registration.query as never)).toBe("plugins_data:watch_changes");
		expect(registration.args).toEqual({
			collection: "messages",
			limit: 100,
			updatedSince: 1_700_000_000_000,
			scopeId: "scope-1",
		});

		const firstDocs = [make_public_doc()];
		registration.callback({ docs: firstDocs, truncated: false });
		const secondDocs = [make_public_doc(), make_public_doc({ key: "m:2" })];
		registration.callback({ docs: secondDocs, truncated: true });

		expect(onUpdate).toHaveBeenNthCalledWith(1, { docs: firstDocs, truncated: false });
		expect(onUpdate).toHaveBeenNthCalledWith(2, { docs: secondDocs, truncated: true });
	});

	test("omitted options are dropped, not forwarded as undefined", async () => {
		const client = await connect_client();

		client.data.watchChanges({ collection: "messages", limit: 50 }, vi.fn());
		const registration = convex_instance().onUpdates[0]!;
		expect(registration.args).toEqual({ collection: "messages", limit: 50 });
		expect("updatedSince" in registration.args).toBe(false);
		expect("scopeId" in registration.args).toBe(false);
	});

	test("a null answer kills the subscription with the same death contract as watch", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		const unsubscribe = client.data.watchChanges({ collection: "messages", limit: 50 }, onUpdate);
		const registration = convex_instance().onUpdates[0]!;

		registration.callback(null);
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "denied",
			message: "This plugin no longer has access to its data",
		});
		expect(registration.unsubscribed).toBe(true);

		registration.callback({ docs: [make_public_doc()], truncated: false });
		unsubscribe();
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});

	test("an out-of-range limit dies at birth and never reaches the client", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		client.data.watchChanges({ collection: "messages", limit: 0 }, onUpdate);
		expect(onUpdate).not.toHaveBeenCalled();
		await flush_deliveries();
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "invalid",
			message: "Watch limits must be integers from 1 to 100",
		});
		expect(convex_instance().onUpdates).toHaveLength(0);
	});

	test("changes watches share the page's sixteen slots and release them on death", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const client = await connect_client();

		for (let index = 1; index <= 15; index += 1) {
			client.data.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		client.data.watchChanges({ collection: "messages", limit: 10 }, vi.fn());
		expect(convex_instance().onUpdates).toHaveLength(16);

		const onRefused = vi.fn();
		client.data.watchChanges({ collection: "messages", limit: 10 }, onRefused);
		await flush_deliveries();
		expect(convex_instance().onUpdates).toHaveLength(16);
		expect(onRefused).toHaveBeenNthCalledWith(1, null, {
			reason: "capacity",
			message: "Subscription limit reached for this plugin frame",
		});
		expect(warnSpy).toHaveBeenCalled();

		convex_instance().onUpdates[15]!.callback(null);
		client.data.watch({ collection: "notes", limit: 10 }, vi.fn());
		expect(convex_instance().onUpdates).toHaveLength(17);
	});

	test("declares watchChanges on the client so a page can name the invalidation feed", async () => {
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		const changesDeclaration = declaration.match(/^\t\twatchChanges\([^]*?\): \(\) => void;/m)?.[0] ?? "";
		expect(changesDeclaration).toContain("updatedSince?: number;");
		expect(declaration).toContain("updatedSince` is an inclusive lower bound");
		expect(declaration).toContain("`newest + 1` so the live query can leave those 100 rows");
		expect(declaration).toContain("permanently skip tied rows past the first 100");
		expect(changesDeclaration).toContain(
			"onUpdate: (update: BonoboUiDataWatchUpdate | null, info?: BonoboUiWatchDeathInfo) => void,",
		);
	});
});

describe("data.watchWindow", () => {
	type FakeWatch = {
		queryArgs: { collection: string; keyPrefix?: string; limit: number };
		bounds: { keyStartExclusive?: string; keyEndInclusive?: string };
		onResult: (outcome: { value: unknown } | { queryError: unknown }) => void;
		disposed: boolean;
	};

	/**
	 * The window manager is not exported, so these tests drive it the way a plugin does: through
	 * the client `bonobo_ui_connect` resolves, on the fake Convex client the module mock installs.
	 *
	 * The SDK wires the manager to that client through `create_convex_data_deps`, which merges the
	 * manager's query args and its interval fenceposts into the ONE args object Convex receives.
	 * So the wrapper below splits them apart again and presents the `FakeWatch` shape the
	 * assertions read. That makes the bound assertions stronger than they were against a
	 * hand-written `start_watch`: they now check the range the SDK really asked the server for.
	 */
	async function make_data_api() {
		const client = await connect_client();
		const instance = convex_instance();
		const startedWatches: FakeWatch[] = [];
		// Results the next started watches are born with, oldest first. A seeded watch mimics
		// the Convex client holding a cached result for identical args: it arrives on a
		// setTimeout(0) after the start call, never synchronously — the client's own contract.
		const seededResults: unknown[] = [];
		const record_watch = instance.onUpdate.bind(instance);

		instance.onUpdate = (query, args, callback, onError) => {
			const { keyStartExclusive, keyEndInclusive, ...queryArgs } = args;
			const unsubscribe = record_watch(query, args, callback, onError);
			const watch: FakeWatch = {
				queryArgs: queryArgs as FakeWatch["queryArgs"],
				bounds: {
					...(keyStartExclusive === undefined ? {} : { keyStartExclusive: keyStartExclusive as string }),
					...(keyEndInclusive === undefined ? {} : { keyEndInclusive: keyEndInclusive as string }),
				},
				// The SDK's own adapter turns the client's two callbacks back into one outcome, so
				// hand the outcome to whichever callback the real client would have called.
				onResult: (outcome) => {
					if ("queryError" in outcome) {
						onError(outcome.queryError as Error);
					} else {
						callback(outcome.value);
					}
				},
				disposed: false,
			};
			startedWatches.push(watch);
			if (seededResults.length > 0) {
				const value = seededResults.shift();
				setTimeout(() => {
					if (!watch.disposed) {
						callback(value);
					}
				}, 0);
			}
			return () => {
				watch.disposed = true;
				unsubscribe();
			};
		};

		return { api: client.data, startedWatches, seededResults };
	}

	async function deliver(watch: FakeWatch, docs: { key: string }[], truncated: boolean) {
		watch.onResult({ value: { docs, truncated } });
		await flush_deliveries();
	}

	function window_updates(onUpdate: ReturnType<typeof vi.fn>) {
		return onUpdate.mock.calls;
	}

	/**
	 * Grows one window to `intervals` bounded intervals, each holding a full page. Per cycle the
	 * newest unbounded interval delivers a truncated page and re-seats onto the range its docs
	 * cover, then loadOlder appends the next unbounded tail. Full pages never merge back, because
	 * a merge needs an adjacent pair holding less than one page between them.
	 */
	async function grow_window(harness: Awaited<ReturnType<typeof make_data_api>>, prefix: string, intervals = 6) {
		const onUpdate = vi.fn();
		const handle = harness.api.watchWindow({ collection: "messages", keyPrefix: prefix, pageSize: 3 }, onUpdate);
		for (let interval = 1; interval <= intervals; interval += 1) {
			const docs = [1, 2, 3].map((slot) => ({ key: `${prefix}${interval}:${slot}` }));
			await deliver(harness.startedWatches.at(-1)!, docs, true);
			if (interval < intervals) {
				handle.loadOlder();
			}
		}
		return { handle, onUpdate };
	}

	test("starts one unbounded read with the caller's args and coalesces identical deliveries", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);

		expect(startedWatches).toHaveLength(1);
		expect(startedWatches[0]!.queryArgs).toEqual({ collection: "messages", keyPrefix: "m:", limit: 3 });
		expect(startedWatches[0]!.bounds).toEqual({});

		await deliver(startedWatches[0]!, [{ key: "m:1" }], false);
		expect(window_updates(onUpdate)).toEqual([
			[{ docs: [{ key: "m:1" }], hasMore: false, atCapacity: false, incomplete: false }],
		]);

		// An identical delivery coalesces away: the whole payload is unchanged.
		await deliver(startedWatches[0]!, [{ key: "m:1" }], false);
		expect(window_updates(onUpdate)).toHaveLength(1);

		handle.unsubscribe();
		expect(startedWatches[0]!.disposed).toBe(true);
		expect(window_updates(onUpdate)).toHaveLength(1);
	});

	test("a truncated first delivery re-seats behind one update that already says hasMore", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);

		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);

		// The re-seat happened before the flush: exactly one update, content unchanged, hasMore on.
		expect(window_updates(onUpdate)).toEqual([
			[{ docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], hasMore: true, atCapacity: false, incomplete: false }],
		]);
		expect(startedWatches[0]!.disposed).toBe(true);
		expect(startedWatches).toHaveLength(2);
		// The new subscription pins the window to its own largest delivered key.
		expect(startedWatches[1]!.bounds).toEqual({ keyEndInclusive: "m:3" });
	});

	test("loadOlder appends an unbounded tail from the stored bound", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);

		handle.loadOlder();
		expect(startedWatches).toHaveLength(3);
		expect(startedWatches[2]!.bounds).toEqual({ keyStartExclusive: "m:3" });

		// The tail's first non-truncated delivery closes the history: hasMore drops.
		await deliver(startedWatches[2]!, [{ key: "m:4" }, { key: "m:5" }], false);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }, { key: "m:4" }, { key: "m:5" }],
				hasMore: false,
				atCapacity: false,
				incomplete: false,
			},
		]);

		// With the whole range covered, another loadOlder is a silent no-op and starts nothing.
		handle.loadOlder();
		await flush_deliveries();
		expect(startedWatches).toHaveLength(3);
	});

	test("loadOlder called synchronously from inside a delivery still grows the window", async () => {
		// The window flush calls the page's onUpdate directly, so a chitchat-style catch-up loop
		// (call loadOlder whenever an update still says hasMore) now runs inside the flush call
		// stack instead of behind a postMessage hop. The re-entrant call must behave like any
		// other loadOlder.
		const { api, startedWatches } = await make_data_api();
		let handle: { loadOlder: () => void; unsubscribe: () => void } | null = null;
		const onUpdate = vi.fn((update: { hasMore: boolean } | null) => {
			if (update?.hasMore) {
				handle?.loadOlder();
			}
		});
		handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);

		// The truncated head re-seats and flushes hasMore: the onUpdate above immediately asks
		// for older history, which must start the tail read right there.
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		expect(startedWatches).toHaveLength(3);
		expect(startedWatches[2]!.bounds).toEqual({ keyStartExclusive: "m:3" });

		await deliver(startedWatches[2]!, [{ key: "m:4" }], false);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }, { key: "m:4" }],
				hasMore: false,
				atCapacity: false,
				incomplete: false,
			},
		]);
	});

	test("an arrival overflow splits the interval and the swap commits in one update", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		// The re-seated watcher confirms the same content: whole payload unchanged, no update.
		await deliver(startedWatches[1]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], false);
		expect(window_updates(onUpdate)).toHaveLength(1);

		// Two arrivals push the old docs past the page size: the interval re-reads as newest-3.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1" }], true);
		// The split starts left (.. lte previously-first key] and right (gt it .. old end].
		expect(startedWatches).toHaveLength(4);
		expect(startedWatches[2]!.bounds).toEqual({ keyEndInclusive: "m:1" });
		expect(startedWatches[3]!.bounds).toEqual({ keyStartExclusive: "m:1", keyEndInclusive: "m:3" });
		// No second update. The truncated re-read dropped m:2 and m:3 out of the middle of the
		// parent's array, so posting it would show a hole. While the split is pending the parent
		// contributes the last complete array it held instead, which is what the first update
		// already carried — so the payload is unchanged and the dedupe swallows it. The two
		// arrivals appear when the swap commits, one round trip later.
		expect(window_updates(onUpdate)).toHaveLength(1);

		// One replacement delivering does not commit or post: the swap is all-or-nothing. The
		// right side goes first on purpose — a premature commit here would splice in an
		// undelivered left interval and the arrivals would vanish from the flattened list.
		await deliver(startedWatches[3]!, [{ key: "m:2" }, { key: "m:3" }], false);
		expect(window_updates(onUpdate)).toHaveLength(1);
		expect(startedWatches[1]!.disposed).toBe(false);

		await deliver(startedWatches[2]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1" }], false);
		expect(startedWatches[1]!.disposed).toBe(true);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1" }, { key: "m:2" }, { key: "m:3" }],
				hasMore: true,
				atCapacity: false,
				incomplete: false,
			},
		]);
		expect(window_updates(onUpdate)).toHaveLength(2);
	});

	test("a split replaces only the interval it split, not the neighbour below it", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);

		// Load one older page first. The window then holds two intervals, so the split below
		// happens at an index that has a neighbour after it.
		handle.loadOlder();
		await deliver(startedWatches[2]!, [{ key: "m:4" }, { key: "m:5" }], false);
		expect(startedWatches).toHaveLength(3);

		// Arrivals overflow the FIRST of the two intervals: left is watch 3, right is watch 4.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1" }], true);
		expect(startedWatches).toHaveLength(5);
		expect(startedWatches[3]!.bounds).toEqual({ keyEndInclusive: "m:1" });
		expect(startedWatches[4]!.bounds).toEqual({ keyStartExclusive: "m:1", keyEndInclusive: "m:3" });

		await deliver(startedWatches[4]!, [{ key: "m:2" }, { key: "m:3" }], false);
		await deliver(startedWatches[3]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1" }], false);

		// The commit swaps out the split interval alone. Taking the neighbour with it would stop
		// a live subscription and drop its docs out of the flattened list.
		expect(startedWatches[1]!.disposed).toBe(true);
		expect(startedWatches[2]!.disposed).toBe(false);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [
					{ key: "m:0a" },
					{ key: "m:0b" },
					{ key: "m:1" },
					{ key: "m:2" },
					{ key: "m:3" },
					{ key: "m:4" },
					{ key: "m:5" },
				],
				hasMore: false,
				atCapacity: false,
				incomplete: false,
			},
		]);
	});

	test("a truncated interval whose only fencepost is its own bound reports incomplete", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);

		// A second bounded interval: the tail delivers truncated and re-seats onto (m:3 .. m:6].
		handle.loadOlder();
		await deliver(startedWatches[2]!, [{ key: "m:4" }, { key: "m:5" }, { key: "m:6" }], true);
		expect(startedWatches).toHaveLength(4);
		expect(startedWatches[3]!.bounds).toEqual({ keyStartExclusive: "m:3", keyEndInclusive: "m:6" });

		// Deletes leave that interval holding one doc, which is also its upper bound.
		await deliver(startedWatches[3]!, [{ key: "m:6" }], false);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }, { key: "m:6" }],
				hasMore: true,
				atCapacity: false,
				incomplete: false,
			},
		]);

		// Three arrivals inside that range push m:6 out of the read. The split may only use the
		// previously delivered first key as its fencepost, and that key is m:6, the interval's
		// own bound. Splitting there would recreate the parent's exact args, so it is refused.
		// m:6 is now missing from the middle of the list, and the payload has to say so.
		await deliver(startedWatches[3]!, [{ key: "m:4a" }, { key: "m:4b" }, { key: "m:4c" }], true);
		expect(startedWatches).toHaveLength(4);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }, { key: "m:4a" }, { key: "m:4b" }, { key: "m:4c" }],
				hasMore: true,
				atCapacity: false,
				incomplete: true,
			},
		]);
	});

	test("an interval a pending split is already replacing is repaired, not incomplete", async () => {
		const harness = await make_data_api();
		const { startedWatches } = harness;
		const { onUpdate } = await grow_window(harness, "m:", 5);
		const olderPages = [2, 3, 4, 5].flatMap((interval) => [1, 2, 3].map((slot) => ({ key: `m:${interval}:${slot}` })));

		// Arrivals overflow the first interval. The split has room for a sixth interval. While it
		// runs, committed plus pending is 7, which is past the ceiling. That must not read as a
		// hole: the range is being re-read, not stuck.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }], true);
		expect(startedWatches).toHaveLength(12);
		// m:1:2 and m:1:3 fell out of the middle of the parent's re-read. The payload must not show
		// that hole, so while the split is pending the parent contributes the last complete array it
		// held — the arrivals m:0a and m:0b wait for the commit below. `incomplete` stays false for
		// the same reason it did before: the range is being re-read, not stuck.
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:1:1" }, { key: "m:1:2" }, { key: "m:1:3" }, ...olderPages],
				hasMore: true,
				atCapacity: false,
				incomplete: false,
			},
		]);

		// The swap commits and the two halves cover the whole parent range again.
		await deliver(startedWatches[11]!, [{ key: "m:1:2" }, { key: "m:1:3" }], false);
		await deliver(startedWatches[10]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }], false);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }, { key: "m:1:2" }, { key: "m:1:3" }, ...olderPages],
				hasMore: true,
				atCapacity: true,
				incomplete: false,
			},
		]);
	});

	test("a denial mid-split kills the whole window with exactly one null", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		await deliver(startedWatches[1]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], false);
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1" }], true);
		expect(startedWatches).toHaveLength(4);

		// One pending replacement answers a denial: every watcher dies, committed and pending.
		startedWatches[2]!.onResult({ value: null });
		await flush_deliveries();
		expect(startedWatches.every((watch) => watch.disposed)).toBe(true);
		// One reason for the whole window, whichever interval saw the refusal.
		expect(window_updates(onUpdate).at(-1)).toEqual([
			null,
			{ reason: "denied", message: "This plugin no longer has access to its data" },
		]);
		const updatesAfterKill = window_updates(onUpdate).length;

		// The other pending replacement's late delivery reaches a dead window: no update, and a
		// loadOlder on the dead handle starts nothing.
		await deliver(startedWatches[3]!, [{ key: "m:2" }], false);
		handle.loadOlder();
		await flush_deliveries();
		expect(window_updates(onUpdate)).toHaveLength(updatesAfterKill);
		expect(startedWatches).toHaveLength(4);
	});

	test("a cached truncated first delivery still re-seats and reports hasMore", async () => {
		const { api, startedWatches, seededResults } = await make_data_api();
		const onUpdate = vi.fn();

		// A sibling subscription with identical args leaves a cached result in the client, so
		// the head's first delivery arrives on the client's own setTimeout(0) instead of a later
		// server answer. The window must still see it AFTER its bookkeeping registered the
		// interval: the re-seat and the hasMore it implies must match the live path exactly.
		seededResults.push({ docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], truncated: true });
		api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await flush_deliveries();

		expect(startedWatches).toHaveLength(2);
		expect(startedWatches[1]!.bounds).toEqual({ keyEndInclusive: "m:3" });
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{ docs: [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], hasMore: true, atCapacity: false, incomplete: false },
		]);
	});

	test("a cached denial at window start kills it without leaking the subscription", async () => {
		const { api, startedWatches, seededResults } = await make_data_api();
		const onUpdate = vi.fn();

		// The page retries a just-denied read as a window before the server confirms the
		// removal: the head's first read answers the cached null. The kill must find the started
		// interval — a missed dispose here would leak a subscription on the page's Convex client
		// until the page reloads.
		seededResults.push(null);
		api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await flush_deliveries();

		expect(startedWatches[0]!.disposed).toBe(true);
		expect(window_updates(onUpdate)).toEqual([
			[null, { reason: "denied", message: "This plugin no longer has access to its data" }],
		]);

		// The slot came back: a fresh watch starts instead of hitting a phantom ceiling.
		api.watch({ collection: "notes", limit: 10 }, vi.fn());
		expect(startedWatches).toHaveLength(2);
	});

	test("the interval ceiling reports atCapacity and refuses the next loadOlder", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);

		// Grow to the 6-interval ceiling: the head re-seats, then each loadOlder tail delivers
		// truncated and re-seats into a bounded interval of its own.
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		for (let round = 0; round < 5; round += 1) {
			handle.loadOlder();
			const tail = startedWatches[startedWatches.length - 1]!;
			const base = (round + 1) * 3;
			await deliver(tail, [{ key: `m:${base + 1}` }, { key: `m:${base + 2}` }, { key: `m:${base + 3}` }], true);
		}
		expect(startedWatches).toHaveLength(12);

		// Six intervals: the payload itself reports atCapacity while history stays open.
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: Array.from({ length: 18 }, (_, index) => ({ key: `m:${index + 1}` })),
				hasMore: true,
				atCapacity: true,
				incomplete: false,
			},
		]);

		// The seventh loadOlder starts nothing and posts nothing new: the refusal's payload
		// coalesces away because atCapacity was already on.
		const updatesAtCeiling = window_updates(onUpdate).length;
		handle.loadOlder();
		await flush_deliveries();
		expect(startedWatches).toHaveLength(12);
		expect(window_updates(onUpdate)).toHaveLength(updatesAtCeiling);
	});

	test("a sibling interval is not called incomplete during a pending split", async () => {
		const harness = await make_data_api();
		const { startedWatches } = harness;
		const { onUpdate } = await grow_window(harness, "m:", 4);

		// A split on the newest interval puts the window at four committed plus two pending.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }], true);
		expect(startedWatches).toHaveLength(10);

		// A different interval truncates while that swap is still in flight — an ordinary shape in
		// the reactions window, where a reaction on an old message lands inside a closed older
		// range. The pending exclusion only covers the interval being replaced, so this one is
		// judged on the interval count. Measured gross it reads 4 + 2 + 1 = 7 and answers "no room
		// to repair"; the swap actually settles at five, so a split for this one still fits. Calling
		// it a hole here fires the page's gap notice on a transient that heals itself.
		await deliver(startedWatches[5]!, [{ key: "m:3:0a" }, { key: "m:3:0b" }, { key: "m:3:1" }], true);
		expect(window_updates(onUpdate).at(-1)![0].incomplete).toBe(false);
	});

	test("the 6-interval loss is permanent", async () => {
		const harness = await make_data_api();
		const { startedWatches } = harness;
		const { onUpdate } = await grow_window(harness, "m:", 6);

		// All six interval slots are spent, so the split that would absorb arrivals is refused and
		// the range stays truncated. Each further arrival pushes one more document out of the read,
		// and none of them ever come back: the loss is not a transient the window repairs later.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }], true);
		await deliver(startedWatches[1]!, [{ key: "m:0c" }, { key: "m:0d" }, { key: "m:0a" }], true);
		const payload = window_updates(onUpdate).at(-1)![0];
		expect(payload.docs.map((doc: { key: string }) => doc.key)).not.toContain("m:1:1");
		expect(payload.incomplete).toBe(true);
	});

	test("a split refused by the interval ceiling reports incomplete", async () => {
		const harness = await make_data_api();
		const { startedWatches } = harness;
		const { onUpdate } = await grow_window(harness, "m:", 6);
		expect(startedWatches).toHaveLength(12);

		// Arrivals overflow the window's newest range while all six interval slots are spent. The
		// split that would absorb them needs a seventh, so the range stays truncated and the docs
		// it can no longer reach are missing from the middle of the list.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }], true);
		expect(startedWatches).toHaveLength(12);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [
					{ key: "m:0a" },
					{ key: "m:0b" },
					{ key: "m:1:1" },
					...[2, 3, 4, 5, 6].flatMap((interval) => [1, 2, 3].map((slot) => ({ key: `m:${interval}:${slot}` }))),
				],
				hasMore: true,
				atCapacity: true,
				incomplete: true,
			},
		]);
	});

	test("adjacent intervals that shrink below one page merge back into one subscription", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		handle.loadOlder();
		await deliver(startedWatches[2]!, [{ key: "m:4" }, { key: "m:5" }], false);
		expect(startedWatches).toHaveLength(3);

		// Physical deletes shrink the head interval: 1 + 2 = 3 docs still fill one page, so the
		// pair keeps its own subscriptions (one full page would re-split on the next arrival).
		await deliver(startedWatches[1]!, [{ key: "m:1" }], false);
		expect(startedWatches).toHaveLength(3);

		// The tail shrinks too: 1 + 1 = 2 docs fit one page, and the merge starts one
		// subscription over the combined range.
		await deliver(startedWatches[2]!, [{ key: "m:4" }], false);
		expect(startedWatches).toHaveLength(4);
		expect(startedWatches[3]!.bounds).toEqual({});
		// All-or-nothing: the replaced pair keeps delivering until the merged read has a result.
		expect(startedWatches[1]!.disposed).toBe(false);
		expect(startedWatches[2]!.disposed).toBe(false);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{ docs: [{ key: "m:1" }, { key: "m:4" }], hasMore: false, atCapacity: false, incomplete: false },
		]);

		// The commit swaps the pair out and reclaims their server slots. The flattened list is
		// unchanged, so the commit itself posts nothing.
		const updatesBeforeCommit = window_updates(onUpdate).length;
		await deliver(startedWatches[3]!, [{ key: "m:1" }, { key: "m:4" }], false);
		expect(startedWatches[1]!.disposed).toBe(true);
		expect(startedWatches[2]!.disposed).toBe(true);
		expect(window_updates(onUpdate)).toHaveLength(updatesBeforeCommit);
	});

	test("a pending merge hides no hole", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		handle.loadOlder();
		await deliver(startedWatches[2]!, [{ key: "m:4" }, { key: "m:5" }], false);
		await deliver(startedWatches[1]!, [{ key: "m:1" }], false);
		await deliver(startedWatches[2]!, [{ key: "m:4" }], false);
		expect(startedWatches).toHaveLength(4);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{ docs: [{ key: "m:1" }, { key: "m:4" }], hasMore: false, atCapacity: false, incomplete: false },
		]);

		// A merge suppresses TWO intervals, not one. The first of the pair is still subscribed and
		// still delivering, so an arrival burst inside its range re-reads it truncated and drops
		// m:1 out of the middle of the flatten. The pending exclusion covers both indexes, so the
		// hole would ship with incomplete: false — the one payload the window must never emit.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:0c" }], true);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{ docs: [{ key: "m:1" }, { key: "m:4" }], hasMore: false, atCapacity: false, incomplete: false },
		]);

		// And the merged read still commits to the same list.
		const updatesBeforeCommit = window_updates(onUpdate).length;
		await deliver(startedWatches[3]!, [{ key: "m:1" }, { key: "m:4" }], false);
		expect(startedWatches[1]!.disposed).toBe(true);
		expect(window_updates(onUpdate)).toHaveLength(updatesBeforeCommit);
	});

	test("a pending-split snapshot survives a second delivery to the parent", async () => {
		const harness = await make_data_api();
		const { startedWatches } = harness;
		const { onUpdate } = await grow_window(harness, "m:", 5);
		const olderPages = [2, 3, 4, 5].flatMap((interval) => [1, 2, 3].map((slot) => ({ key: `m:${interval}:${slot}` })));

		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:1:1" }], true);
		expect(startedWatches).toHaveLength(12);
		const payloadAfterSplitStarted = window_updates(onUpdate).at(-1);
		expect(payloadAfterSplitStarted).toEqual([
			{
				docs: [{ key: "m:1:1" }, { key: "m:1:2" }, { key: "m:1:3" }, ...olderPages],
				hasMore: true,
				atCapacity: false,
				incomplete: false,
			},
		]);

		// The parent stays subscribed for the whole pending window, so any second write inside its
		// range re-delivers it. At Chitchat's pageSize of 100 that is an ordinary append, edit or
		// soft delete. The snapshot belongs to the pending swap, not to the interval, so a second
		// delivery must not re-capture it — if it did, this flush would emit the truncated array,
		// which differs from the last payload and so survives the whole-payload dedupe.
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:0c" }], true);
		expect(window_updates(onUpdate).at(-1)).toEqual(payloadAfterSplitStarted);
	});

	test("a first-delivery truncation loses nothing while its own split is pending", async () => {
		const { api, startedWatches } = await make_data_api();
		const onUpdate = vi.fn();
		api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onUpdate);
		await deliver(startedWatches[0]!, [{ key: "m:1" }, { key: "m:2" }, { key: "m:3" }], true);
		await deliver(startedWatches[1]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:0c" }], true);
		expect(startedWatches).toHaveLength(4);
		expect(startedWatches[2]!.bounds).toEqual({ keyEndInclusive: "m:1" });

		// The left replacement's range holds four documents, so its FIRST delivery truncates and
		// sheds its own upper bound, m:1. It therefore has no previous array to fall back on.
		await deliver(startedWatches[2]!, [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:0c" }], true);
		await deliver(startedWatches[3]!, [{ key: "m:2" }, { key: "m:3" }], false);

		// The commit installs left, and reconcile immediately splits it again at its own fallback
		// fencepost. While THAT split is pending, left is suppressed and has a null previous array.
		// Substituting an empty array there would make every key it just delivered disappear for a
		// round trip — the exact failure the substitution exists to prevent — so it falls back to
		// the live array instead.
		expect(startedWatches).toHaveLength(6);
		expect(window_updates(onUpdate).at(-1)).toEqual([
			{
				docs: [{ key: "m:0a" }, { key: "m:0b" }, { key: "m:0c" }, { key: "m:2" }, { key: "m:3" }],
				hasMore: true,
				atCapacity: false,
				incomplete: false,
			},
		]);
	});

	test("a window occupies one page-visible slot, and the seventeenth watch dies as capacity", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { api, startedWatches } = await make_data_api();

		api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, vi.fn());
		for (let index = 1; index <= 15; index += 1) {
			api.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		expect(startedWatches).toHaveLength(16);

		const onRefused = vi.fn();
		api.watch({ collection: "notes", limit: 10 }, onRefused);
		await flush_deliveries();
		expect(startedWatches).toHaveLength(16);
		expect(onRefused).toHaveBeenNthCalledWith(1, null, {
			reason: "capacity",
			message: "Subscription limit reached for this plugin frame",
		});
		expect(warnSpy).toHaveBeenCalled();
	});

	test("the seventeenth subscription dies as capacity when it is a window", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { api, startedWatches } = await make_data_api();

		for (let index = 1; index <= 16; index += 1) {
			api.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		expect(startedWatches).toHaveLength(16);

		// The sixteen page-visible slots refuse a window exactly like they refuse a plain watch.
		// The refusal names itself, so a page holding real slots closes one instead of reading
		// the death as access gone.
		const onRefused = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 3 }, onRefused);
		await flush_deliveries();
		expect(startedWatches).toHaveLength(16);
		expect(onRefused).toHaveBeenNthCalledWith(1, null, {
			reason: "capacity",
			message: "Subscription limit reached for this plugin frame",
		});
		expect(warnSpy).toHaveBeenCalled();

		// Nothing was registered, so the handle has nothing to grow or dispose.
		handle.loadOlder();
		handle.unsubscribe();
		expect(startedWatches).toHaveLength(16);
	});

	// The page's server-subscription ceiling is a backstop at 100, one per plain watch and one
	// per window interval. Four windows at their 6-interval limit spend 24 of 100 while holding
	// only four of the sixteen page-visible slots, so the next watch must live. On the old 24
	// ceiling this assertion was `expected 25, received 24`.
	test("four fully-grown windows leave room under the 100-subscription backstop", async () => {
		const harness = await make_data_api();
		const { api, startedWatches } = harness;
		const live_watches = () => startedWatches.filter((watch) => !watch.disposed);

		await grow_window(harness, "a:");
		await grow_window(harness, "b:");
		await grow_window(harness, "c:");
		await grow_window(harness, "d:");
		expect(live_watches()).toHaveLength(24);

		const onRefused = vi.fn();
		api.watch({ collection: "notes", limit: 10 }, onRefused);
		await flush_deliveries();
		expect(onRefused).not.toHaveBeenCalled();
		expect(live_watches()).toHaveLength(25);
	});

	test("sixteen fully-grown windows spend 96 of the 100-subscription backstop and the seventeenth watch dies as capacity", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const harness = await make_data_api();
		const { api, startedWatches } = harness;
		const live_watches = () => startedWatches.filter((watch) => !watch.disposed);

		const prefixes = "abcdefghijklmnop";
		const { handle: firstWindow } = await grow_window(harness, `${prefixes[0]}:`);
		for (const letter of prefixes.slice(1)) {
			await grow_window(harness, `${letter}:`);
		}
		expect(live_watches()).toHaveLength(96);

		const onRefused = vi.fn();
		api.watch({ collection: "notes", limit: 10 }, onRefused);
		await flush_deliveries();
		expect(onRefused).toHaveBeenNthCalledWith(1, null, {
			reason: "capacity",
			message: "Subscription limit reached for this plugin frame",
		});
		expect(warnSpy).toHaveBeenCalled();
		expect(live_watches()).toHaveLength(96);

		// Closing one window returns its six subscriptions and one slot. The same watch starts.
		// That is what proves the refusal above came from the sixteen-slot cap: 90 server
		// subscriptions still sit well under the 100 backstop.
		firstWindow.unsubscribe();
		expect(live_watches()).toHaveLength(90);
		api.watch({ collection: "notes", limit: 10 }, vi.fn());
		expect(live_watches()).toHaveLength(91);
	});

	test("four fully-grown windows do not kill a new window at birth", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const harness = await make_data_api();
		const { api, startedWatches } = harness;
		const live_watches = () => startedWatches.filter((watch) => !watch.disposed);

		await grow_window(harness, "a:");
		await grow_window(harness, "b:");
		await grow_window(harness, "c:");
		await grow_window(harness, "d:");
		expect(live_watches()).toHaveLength(24);

		const onRefused = vi.fn();
		const handle = api.watchWindow({ collection: "messages", keyPrefix: "e:", pageSize: 3 }, onRefused);
		await flush_deliveries();
		expect(live_watches()).toHaveLength(25);
		expect(onRefused).not.toHaveBeenCalled();
		expect(errorSpy).not.toHaveBeenCalled();

		handle.unsubscribe();
		expect(live_watches()).toHaveLength(24);
	});

	test("a split still starts when four windows have spent 24 of the 100-subscription backstop", async () => {
		const harness = await make_data_api();
		const { api, startedWatches } = harness;

		// Three full windows plus a two-interval one spend 20 subscriptions. Four plain watches
		// spend four more. That is the old 24-subscription fill: it used to refuse this split.
		await grow_window(harness, "a:");
		await grow_window(harness, "b:");
		await grow_window(harness, "c:");
		const { onUpdate } = await grow_window(harness, "d:", 2);
		for (let index = 1; index <= 4; index += 1) {
			api.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		const liveWindowWatches = startedWatches.filter((watch) => !watch.disposed && watch.queryArgs.keyPrefix === "d:");
		expect(liveWindowWatches).toHaveLength(2);

		await deliver(liveWindowWatches[0]!, [{ key: "d:0a" }, { key: "d:0b" }, { key: "d:1:1" }], true);
		expect(startedWatches.filter((watch) => !watch.disposed).length).toBeGreaterThan(24);
		expect(window_updates(onUpdate).at(-1)?.[0]).toMatchObject({
			incomplete: false,
		});
	});

	test("a split that needs two server slots still starts when 23 of 100 are spent", async () => {
		const harness = await make_data_api();
		const { api, startedWatches } = harness;

		// Three full windows plus a two-interval one spend 20 subscriptions, and THREE plain
		// watches spend three more. That is the old "one free slot of 24" fill: it used to
		// start the left replacement, refuse the right, and report incomplete.
		await grow_window(harness, "a:");
		await grow_window(harness, "b:");
		await grow_window(harness, "c:");
		const { onUpdate } = await grow_window(harness, "d:", 2);
		for (let index = 1; index <= 3; index += 1) {
			api.watch({ collection: "notes", limit: 10 }, vi.fn());
		}
		expect(startedWatches.filter((watch) => !watch.disposed)).toHaveLength(23);
		const liveWindowWatches = startedWatches.filter((watch) => !watch.disposed && watch.queryArgs.keyPrefix === "d:");
		expect(liveWindowWatches).toHaveLength(2);

		await deliver(liveWindowWatches[0]!, [{ key: "d:0a" }, { key: "d:0b" }, { key: "d:1:1" }], true);
		expect(startedWatches.filter((watch) => !watch.disposed).length).toBeGreaterThan(23);
		expect(window_updates(onUpdate).at(-1)?.[0]).toMatchObject({
			incomplete: false,
		});
	});

	test("invalid window inputs die at birth and the handle is inert", async () => {
		const { api, startedWatches } = await make_data_api();

		const onUpdate = vi.fn();
		const handle = api.watchWindow({ collection: "a".repeat(129), pageSize: 10 }, onUpdate);
		await flush_deliveries();
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "invalid",
			message: "Collection names must be 1 to 128 characters",
		});
		handle.loadOlder();
		handle.unsubscribe();
		expect(startedWatches).toHaveLength(0);
	});
});

describe("data writes", () => {
	test("each op runs its own mutation and passes the Result through verbatim", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		const appendResult = { _yay: { key: "r:0001:ab", revision: 1, byteSize: 12 } };
		const putResult = { _nay: { name: "conflict", message: "Revision mismatch" } };
		instance.mutation.mockImplementation((query: unknown) => {
			const name = getFunctionName(query as never);
			if (name === "plugins_data:user_append_document") {
				return Promise.resolve(appendResult);
			}
			if (name === "plugins_data:user_put_document") {
				return Promise.resolve(putResult);
			}
			return Promise.resolve({ _yay: { deleted: true } });
		});

		await expect(
			client.data.append({ collection: "replies", keyPrefix: "r:", value: { body: "yo" }, clientRequestId: "req_1" }),
		).resolves.toBe(appendResult);
		await expect(client.data.put({ collection: "messages", key: "m:1", value: { body: "hi" } })).resolves.toBe(
			putResult,
		);
		await expect(client.data.remove({ collection: "messages", key: "m:1" })).resolves.toEqual({
			_yay: { deleted: true },
		});
		await client.data.putOwned({ collection: "reactions", key: "m:1:heart", value: { on: true } });
		await client.data.removeOwned({ collection: "reactions", key: "m:1:heart" });

		const calls = instance.mutation.mock.calls.map((call) => [getFunctionName(call[0] as never), call[1]]);
		expect(calls).toEqual([
			[
				"plugins_data:user_append_document",
				{ collection: "replies", keyPrefix: "r:", value: { body: "yo" }, clientRequestId: "req_1" },
			],
			["plugins_data:user_put_document", { collection: "messages", key: "m:1", value: { body: "hi" } }],
			["plugins_data:user_remove_document", { collection: "messages", key: "m:1" }],
			["plugins_data:user_put_owned_document", { collection: "reactions", key: "m:1:heart", value: { on: true } }],
			["plugins_data:user_remove_owned_document", { collection: "reactions", key: "m:1:heart" }],
		]);
	});

	test("expectedRevision rides put, remove, putOwned, and removeOwned when given", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		instance.mutation.mockResolvedValue({ _yay: {} });

		await client.data.put({ collection: "channels", key: "c:1", value: { name: "general" }, expectedRevision: 3 });
		await client.data.remove({ collection: "channels", key: "c:1", expectedRevision: 4 });
		// expectedRevision 0 means "the key must not exist yet" and must reach the args, not be
		// dropped as falsy.
		await client.data.putOwned({ collection: "profiles", key: "status", value: { text: "hi" }, expectedRevision: 0 });
		await client.data.removeOwned({ collection: "profiles", key: "status", expectedRevision: 1 });

		const args = instance.mutation.mock.calls.map((call) => call[1]);
		expect(args).toEqual([
			{ collection: "channels", key: "c:1", value: { name: "general" }, expectedRevision: 3 },
			{ collection: "channels", key: "c:1", expectedRevision: 4 },
			{ collection: "profiles", key: "status", value: { text: "hi" }, expectedRevision: 0 },
			{ collection: "profiles", key: "status", expectedRevision: 1 },
		]);
	});

	test("a thrown mutation resolves the stable unavailable _nay", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = await connect_client();
		convex_instance().mutation.mockRejectedValue(new Error("ArgumentValidationError"));

		await expect(client.data.put({ collection: "notes", key: "k1", value: { body: "hi" } })).resolves.toEqual({
			_nay: { name: "unavailable", message: "Failed to write plugin data" },
		});
		expect(errorSpy).toHaveBeenCalled();
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
		const clientPromise = bonobo_ui_connect();
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
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init({ theme: HOST_THEME }));
		const client = await clientPromise;
		const onChange = vi.fn();
		client.theme.subscribe(onChange);

		// Every field crosses an origin boundary, so a message that fails the check is dropped
		// whole. Half a theme would paint a page with one wrong colour and no way to notice.
		post_from_host({ type: "bonobo:theme", nonce: NONCE, theme: { mode: "dusk", tokens: {} } });
		post_from_host({
			type: "bonobo:theme",
			nonce: NONCE,
			theme: { mode: "light", tokens: { "--color-fg-12": 7 } },
		});
		// The nonce is what proves the message came from this frame's host.
		post_from_host({ type: "bonobo:theme", nonce: "other-nonce", theme: { mode: "light", tokens: {} } });

		expect(onChange).not.toHaveBeenCalled();
		expect(client.theme.current()).toEqual(HOST_THEME);
		// Nothing reached the document either: the dropped light theme left the dark class alone.
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});

	test("stays null when the host sends no theme at all", async () => {
		// The page must be able to tell "no theme" apart from a theme, so it can keep its own colours
		// instead of reading empty strings. The document is left alone too.
		const client = await connect_client();
		expect(client.theme.current()).toBeNull();
		expect(document.documentElement.getAttribute("style")).toBeNull();
		expect(document.documentElement.className).toBe("");
	});
});

describe("members.resolve", () => {
	test("resolves ids through the client and maps a null denial to an empty map", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		instance.query.mockResolvedValueOnce({ members: { user_2: "Ada", user_gone: null } }).mockResolvedValueOnce(null);

		await expect(client.members.resolve(["user_2", "user_gone"])).resolves.toEqual({ user_2: "Ada", user_gone: null });
		expect(getFunctionName(instance.query.mock.calls[0]?.[0] as never)).toBe("plugins_data:resolve_member_display");
		expect(instance.query.mock.calls[0]?.[1]).toEqual({ userIds: ["user_2", "user_gone"] });

		await expect(client.members.resolve(["user_3"])).resolves.toEqual({});
	});

	test("a failed query resolves an empty map instead of rejecting", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = await connect_client();
		convex_instance().query.mockRejectedValue(new Error("network"));

		await expect(client.members.resolve(["user_1"])).resolves.toEqual({});
		expect(errorSpy).toHaveBeenCalled();
	});
});

describe("members.list", () => {
	test("reads a page through the client and follows the cursor", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		instance.query
			.mockResolvedValueOnce({ members: [{ userId: "user_2", displayName: "Ada" }], cursor: "page_2" })
			.mockResolvedValueOnce({ members: [{ userId: "user_3", displayName: null }], cursor: null });

		await expect(client.members.list({ limit: 1 })).resolves.toEqual({
			_yay: { members: [{ userId: "user_2", displayName: "Ada" }], cursor: "page_2" },
		});
		expect(getFunctionName(instance.query.mock.calls[0]?.[0] as never)).toBe("plugins_data:list_members");
		// The first page sends an explicit null cursor rather than leaving it out, because the door
		// takes the cursor as the position to continue from and null is the start.
		expect(instance.query.mock.calls[0]?.[1]).toEqual({ limit: 1, cursor: null });

		// A member with no profile name reads as null, and the last page answers a null cursor.
		await expect(client.members.list({ limit: 1, cursor: "page_2" })).resolves.toEqual({
			_yay: { members: [{ userId: "user_3", displayName: null }], cursor: null },
		});
		expect(instance.query.mock.calls[1]?.[1]).toEqual({ limit: 1, cursor: "page_2" });
	});

	test("a workspace that never granted the capability refuses, and the refusal is not an empty roster", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		instance.query
			.mockResolvedValueOnce({ refusal: "not_consented" })
			.mockResolvedValueOnce({ members: [], cursor: null });

		// This is the whole point of the door's separate refusal value. A plugin that received an
		// empty roster here would render "this workspace has no other members", the admin would never
		// learn there is a consent waiting to be accepted, and the missing capability would look like
		// an empty company.
		const refused = await client.members.list({ limit: 50 });
		expect(refused).toEqual({
			_nay: { name: "not_consented", message: "This workspace has not granted this plugin the member list" },
		});
		expect("_yay" in refused).toBe(false);

		// The same call on a workspace that really holds one member — the caller alone — answers a
		// page, so the two states a page must tell apart do not share a shape.
		await expect(client.members.list({ limit: 50 })).resolves.toEqual({ _yay: { members: [], cursor: null } });
	});

	test("a null answer is denied, and a failed query splits on the session clock", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = await connect_client();
		const instance = convex_instance();

		// null is the door's one answer for every dead-frame refusal: uninstalled, disabled, or a
		// member who left. Unlike the consent refusal above, nobody can accept their way out of it.
		instance.query.mockResolvedValueOnce(null);
		await expect(client.members.list({ limit: 10 })).resolves.toEqual({
			_nay: { name: "denied", message: "This plugin no longer has access to this workspace" },
		});

		instance.query.mockRejectedValueOnce(new Error("network"));
		await expect(client.members.list({ limit: 10 })).resolves.toEqual({
			_nay: { name: "unavailable", message: "The plugin data connection is unavailable" },
		});
		expect(errorSpy).toHaveBeenCalled();
	});

	test("the same failure after the session ran out is session_expired, and stays out of the log", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		// Same split as a watch death: the server answers the same opaque failure either way, so the
		// SDK's own clock is the whole difference, and the advice differs — reload, or wait.
		post_from_host(make_init({ tokenExpiresAt: Date.now() - 1_000 }));
		const client = await clientPromise;
		convex_instance().query.mockRejectedValueOnce(new Error("network"));

		await expect(client.members.list({ limit: 10 })).resolves.toEqual({
			_nay: { name: "session_expired", message: "This plugin session expired" },
		});
		// An ordinary end of a frame's life is not a fault, so it writes no error line.
		expect(errorSpy).not.toHaveBeenCalled();
	});

	test("declares every refusal name a caller has to switch on", async () => {
		// `name` is a plain string in the type, so the doc block is the only place a plugin author
		// learns the values — the same gap the watch death doc has, and the same check. A name the
		// SDK sends and the doc omits is a branch nobody writes, and here the missed branch would be
		// the one an admin can fix.
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		const resultDoc = declaration.match(/\/\*\*[^]*?\*\/\nexport type BonoboUiMemberListResult/)?.[0] ?? "";
		for (const name of ["not_consented", "invalid", "denied", "session_expired", "unavailable"]) {
			expect(resultDoc).toContain(`\`"${name}"\``);
		}

		// A row must stay two fields wide. `users.get_workspace_member_anagraphic` in the host app
		// answers the whole anagraphic document, email included, and a frame may post whatever it
		// reads to the publisher's own origin.
		const memberInterface = declaration.match(/export interface BonoboUiMember \{[^]*?\n\}/)?.[0] ?? "";
		expect(memberInterface).toContain("userId: string;");
		expect(memberInterface).toContain("displayName: string | null;");
		expect(memberInterface).not.toContain("email");
	});

	test("an out-of-range limit is refused before the call reaches the server", async () => {
		const client = await connect_client();

		await expect(client.members.list({ limit: 0 })).resolves.toEqual({
			_nay: { name: "invalid", message: "Member list limits must be integers from 1 to 100" },
		});
		await expect(client.members.list({ limit: 101 })).resolves.toEqual({
			_nay: { name: "invalid", message: "Member list limits must be integers from 1 to 100" },
		});
		// Nothing is clamped, so the page hears about its own bug instead of silently reading 100.
		expect(convex_instance().query).not.toHaveBeenCalled();
	});
});

describe("backend.invoke", () => {
	const SUCCESS_BODY = { runId: "run_1", pluginStatus: 200, output: '{"ok":true}', outputTruncated: false };

	function json_response(body: unknown, status = 200) {
		return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
	}

	test("posts the endpoint id on the UI token and drops omitted fields instead of sending undefined", async () => {
		const client = await connect_client();
		const fetchMock = vi.fn().mockResolvedValue(json_response(SUCCESS_BODY));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			client.backend.invoke({ endpoint: "refresh", input: { requestId: "r1" }, serializationKey: "user_1" }),
		).resolves.toEqual({ _yay: SUCCESS_BODY });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Headers; body: string }];
		expect(url).toBe("https://api.test/api/v1/plugin-backend/invoke");
		expect(init.method).toBe("POST");
		expect(init.headers.get("Authorization")).toBe("Bearer plu_1");
		expect(init.headers.get("Content-Type")).toBe("application/json");
		expect(JSON.parse(init.body)).toEqual({
			endpoint: "refresh",
			input: { requestId: "r1" },
			serializationKey: "user_1",
		});

		// The route's validator is strict, so an omitted input or serializationKey must stay out of
		// the body entirely rather than travel as a literal null.
		await client.backend.invoke({ endpoint: "refresh" });
		const secondBody = JSON.parse((fetchMock.mock.calls[1] as [string, { body: string }])[1].body) as unknown;
		expect(secondBody).toEqual({ endpoint: "refresh" });
	});

	test("relays the backend's own answer, so a non-2xx pluginStatus still resolves _yay", async () => {
		const client = await connect_client();
		const body = { runId: "run_2", pluginStatus: 422, output: "no", outputTruncated: true };
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json_response(body)));

		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({ _yay: body });
	});

	test("a malformed success body resolves unavailable instead of handing the page a half-checked object", async () => {
		const client = await connect_client();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json_response({ runId: 1 })));

		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "unavailable", message: "Failed to run the plugin backend" },
		});
		expect(errorSpy).toHaveBeenCalled();
	});

	test("409 and 429 both map to busy and carry the server's retryAfterMs through", async () => {
		const client = await connect_client();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(json_response({ message: "This endpoint is already running", retryAfterMs: 1500 }, 409))
			.mockResolvedValueOnce(json_response({ message: "Rate limit exceeded", retryAfterMs: 30_000 }, 429))
			.mockResolvedValueOnce(new Response("locked", { status: 409 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "busy", message: "This endpoint is already running", retryAfterMs: 1500 },
		});
		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "busy", message: "Rate limit exceeded", retryAfterMs: 30_000 },
		});
		// A refusal body that is not JSON still maps to busy; retryAfterMs is simply absent.
		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "busy", message: "The plugin backend is busy" },
		});
	});

	test("a live-session refusal is denied, a refused request is invalid, and a failed backend is unavailable", async () => {
		const client = await connect_client();
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(json_response({ message: "Permission denied" }, 403))
			.mockResolvedValueOnce(json_response({ message: "Endpoint not found" }, 404))
			.mockResolvedValueOnce(json_response({ message: "Plugin backend failed", runId: "run_9" }, 502));
		vi.stubGlobal("fetch", fetchMock);

		// The token is minutes from expiry, so the SDK's session clock says this 403 is a real denial.
		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "denied", message: "Permission denied" },
		});
		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "invalid", message: "Endpoint not found" },
		});
		// A 5xx means the outcome is unknown: the run may have half-happened, so the page only
		// retries work it made safe to repeat.
		await expect(client.backend.invoke({ endpoint: "refresh" })).resolves.toEqual({
			_nay: { name: "unavailable", message: "Failed to run the plugin backend" },
		});
		expect(errorSpy).toHaveBeenCalled();
	});

	test("pins the invoke declaration and its result contract in the declaration text", async () => {
		// Same reason as the fetchJson pin: `pnpm run typecheck` passes `--skipLibCheck`, which
		// skips every `.d.ts`, so the declaration text is the only thing a test can hold.
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		expect(declaration).toContain(
			"invoke(opts: { endpoint: string; input?: unknown; serializationKey?: string }): Promise<BonoboUiBackendInvokeResult>;",
		);
		const resultType = declaration.match(/export type BonoboUiBackendInvokeResult =[^]*?\};/)?.[0] ?? "";
		expect(resultType).toContain(
			"{ _yay: { runId: string; pluginStatus: number; output: string; outputTruncated: boolean } }",
		);
		expect(resultType).toContain("{ _nay: { name: string; message: string; retryAfterMs?: number } }");

		// `name` is a plain string in the type, so the doc block is the only place a plugin author
		// learns the vocabulary — the member-list pin's rule, applied here. Anchor on the doc's own
		// first sentence so the scan cannot drift into another type's doc block.
		const resultDoc = declaration.match(/The result of one backend invoke[^]*?\*\//)?.[0] ?? "";
		for (const name of ["busy", "denied", "session_expired", "invalid", "unavailable"]) {
			expect(resultDoc).toContain(`\`"${name}"\``);
		}
		// The one behavior a page author most likely gets wrong: a non-2xx backend answer is not a
		// refusal.
		expect(resultDoc).toContain("still resolves `_yay`");
	});
});

describe("scopes", () => {
	test("every change goes through one mutation, shaped as the action union the door takes", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		instance.mutation.mockResolvedValue({ _yay: { scopeId: "dm-1", deleted: false, membershipRevision: 4 } });

		await expect(
			client.scopes.create({ scopeId: "dm-1", collections: ["channels", "messages"], keyPrefix: "p/dm-1" }),
		).resolves.toEqual({ _yay: { scopeId: "dm-1", deleted: false, membershipRevision: 4 } });
		expect(getFunctionName(instance.mutation.mock.calls[0]?.[0] as never)).toBe("plugins_data:user_manage_scope");
		// One call names every collection. Creating the scope one collection at a time would leave the
		// others readable in between, and would cost the member one scope per collection.
		expect(instance.mutation.mock.calls[0]?.[1]).toEqual({
			action: { kind: "create", scopeId: "dm-1", collections: ["channels", "messages"], keyPrefix: "p/dm-1" },
		});

		await client.scopes.setPrincipal({ scopeId: "dm-1", userId: "user_2", level: "member" });
		expect(instance.mutation.mock.calls[1]?.[1]).toEqual({
			action: { kind: "set_principal", scopeId: "dm-1", userId: "user_2", level: "member" },
		});

		await client.scopes.removePrincipal({ scopeId: "dm-1", userId: "user_2", expectedPrincipalCount: 2 });
		expect(instance.mutation.mock.calls[2]?.[1]).toEqual({
			action: {
				kind: "remove_principal",
				scopeId: "dm-1",
				userId: "user_2",
				expectedPrincipalCount: 2,
			},
		});

		await client.scopes.delete({ scopeId: "dm-1", expectedPrincipalCount: 2 });
		expect(instance.mutation.mock.calls[3]?.[1]).toEqual({
			action: { kind: "delete", scopeId: "dm-1", expectedPrincipalCount: 2 },
		});

		await client.scopes.removePrincipal({ scopeId: "dm-1", userId: "user_2" });
		await client.scopes.delete({ scopeId: "dm-1" });
		expect(instance.mutation.mock.calls[4]?.[1]).toEqual({
			action: { kind: "remove_principal", scopeId: "dm-1", userId: "user_2" },
		});
		expect(instance.mutation.mock.calls[5]?.[1]).toEqual({ action: { kind: "delete", scopeId: "dm-1" } });
	});

	test("createWithDocument sends the full private setup through one mutation", async () => {
		const client = await connect_client();
		const instance = convex_instance();
		instance.mutation.mockResolvedValue({
			_yay: { scopeId: "p/dm-atomic", deleted: false, membershipRevision: 1 },
		});

		await expect(
			client.scopes.createWithDocument({
				scopeId: "p/dm-atomic",
				collections: ["channels", "messages", "replies", "reactions"],
				keyPrefix: "p/dm-atomic",
				principals: [{ userId: "user_2", level: "member" }],
				document: {
					collection: "channels",
					key: "p/dm-atomic",
					value: { name: "Private room", archivedAt: null },
				},
			}),
		).resolves.toEqual({ _yay: { scopeId: "p/dm-atomic", deleted: false, membershipRevision: 1 } });

		expect(instance.mutation).toHaveBeenCalledTimes(1);
		expect(getFunctionName(instance.mutation.mock.calls[0]?.[0] as never)).toBe("plugins_data:user_manage_scope");
		expect(instance.mutation.mock.calls[0]?.[1]).toEqual({
			action: {
				kind: "create_with_document",
				scopeId: "p/dm-atomic",
				collections: ["channels", "messages", "replies", "reactions"],
				keyPrefix: "p/dm-atomic",
				principals: [{ userId: "user_2", level: "member" }],
				document: {
					collection: "channels",
					key: "p/dm-atomic",
					value: { name: "Private room", archivedAt: null },
				},
			},
		});
	});

	test("a refusal passes through, and a failed call resolves unavailable instead of rejecting", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = await connect_client();
		const instance = convex_instance();

		instance.mutation.mockResolvedValueOnce({
			_nay: { name: "conflict", message: "Another scope already covers part of this key range" },
		});
		await expect(
			client.scopes.create({ scopeId: "dm-2", collections: ["messages"], keyPrefix: "p/dm-2" }),
		).resolves.toEqual({ _nay: { name: "conflict", message: "Another scope already covers part of this key range" } });

		instance.mutation.mockRejectedValueOnce(new Error("network"));
		await expect(client.scopes.delete({ scopeId: "dm-2" })).resolves.toEqual({
			_nay: { name: "unavailable", message: "Failed to change who can read this" },
		});
		expect(errorSpy).toHaveBeenCalled();
	});

	test("reading the people in a scope separates exact null from unavailable and validates the result", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		const client = await connect_client();
		const instance = convex_instance();

		instance.query.mockResolvedValueOnce([{ userId: "user_2", level: "manage" }]);
		await expect(client.scopes.listPrincipals({ scopeId: "dm-3" })).resolves.toEqual({
			_yay: [{ userId: "user_2", level: "manage" }],
		});
		expect(getFunctionName(instance.query.mock.calls[0]?.[0] as never)).toBe("plugins_data:watch_scope_principals");
		expect(instance.query.mock.calls[0]?.[1]).toEqual({ scopeId: "dm-3" });

		instance.query.mockResolvedValueOnce(null);
		await expect(client.scopes.listPrincipals({ scopeId: "dm-3" })).resolves.toEqual({ _yay: null });

		instance.query.mockRejectedValueOnce(new Error("network"));
		await expect(client.scopes.listPrincipals({ scopeId: "dm-3" })).resolves.toEqual({
			_nay: { name: "unavailable", message: "Failed to read who can access this" },
		});

		instance.query.mockResolvedValueOnce([{ userId: "user_2", level: "owner" }]);
		await expect(client.scopes.listPrincipals({ scopeId: "dm-3" })).resolves.toEqual({
			_nay: { name: "unavailable", message: "Failed to read who can access this" },
		});
		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		expect(declaration).toContain(
			"listPrincipals(opts: { scopeId: string }): Promise<BonoboUiScopePrincipalListResult>",
		);
		expect(declaration).toContain('| { _nay: { name: "unavailable"; message: string } };');
		expect(errorSpy).toHaveBeenCalled();
	});

	test("the list of scopes this member is in arrives live, and dies like any other watch", async () => {
		const client = await connect_client();

		const onUpdate = vi.fn();
		const unsubscribe = client.scopes.watchMine(onUpdate);
		const instance = convex_instance();
		expect(instance.onUpdates).toHaveLength(1);
		const registration = instance.onUpdates[0]!;
		expect(getFunctionName(registration.query as never)).toBe("plugins_data:watch_my_scopes");
		expect(registration.args).toEqual({});

		// The first delivery is the whole list, and a later one replaces it. That is what makes a
		// private channel appear in the page the moment somebody adds this member to it.
		registration.callback([
			{
				scopeId: "p/1",
				keyPrefix: "p/1",
				collections: ["channels", "messages"],
				appendActivity: [{ collection: "messages", at: 10, createdByUserId: "user_1", sequence: 1 }],
				level: "manage",
				membershipRevision: 1,
			},
		]);
		registration.callback([
			{
				scopeId: "p/1",
				keyPrefix: "p/1",
				collections: ["channels", "messages"],
				appendActivity: [{ collection: "messages", at: 20, createdByUserId: "user_1", sequence: 2 }],
				level: "manage",
				membershipRevision: 2,
			},
			{
				scopeId: "p/2",
				keyPrefix: "p/2",
				collections: ["channels"],
				appendActivity: [],
				level: "member",
				membershipRevision: 1,
			},
		]);
		expect(onUpdate).toHaveBeenNthCalledWith(1, [
			{
				scopeId: "p/1",
				keyPrefix: "p/1",
				collections: ["channels", "messages"],
				appendActivity: [{ collection: "messages", at: 10, createdByUserId: "user_1", sequence: 1 }],
				level: "manage",
				membershipRevision: 1,
			},
		]);
		expect(onUpdate.mock.calls[1]?.[0]).toHaveLength(2);
		expect(onUpdate.mock.calls[1]?.[0]?.[0]?.appendActivity).toEqual([
			{ collection: "messages", at: 20, createdByUserId: "user_1", sequence: 2 },
		]);

		const declaration = await readFile(join(import.meta.dirname, "frontend.d.ts"), "utf8");
		const scopeInterface = declaration.match(/export interface BonoboUiScope \{[^]*?\n\}/)?.[0] ?? "";
		expect(scopeInterface).toContain(
			"appendActivity: Array<{ collection: string; at: number; createdByUserId: string; sequence: number }>",
		);
		expect(scopeInterface).toContain("`sequence` increases for each new accepted append in that collection");
		expect(scopeInterface).toContain("This does not change `membershipRevision`");

		// Losing the frame's access kills this subscription the same way it kills a document watch.
		registration.callback(null);
		expect(onUpdate).toHaveBeenLastCalledWith(null, {
			reason: "denied",
			message: "This plugin no longer has access to its data",
		});
		expect(registration.unsubscribed).toBe(true);

		// The slot came back, so a watch opened after the death still starts.
		unsubscribe();
		client.data.watch({ collection: "messages", limit: 10 }, vi.fn());
		expect(instance.onUpdates).toHaveLength(2);
	});
});
