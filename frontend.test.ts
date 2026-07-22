import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { bonobo_ui_connect } from "./frontend.js";

const HOST_ORIGIN = "https://host.test";
const BRIDGE_NONCE = "0f8fad5b-d9cb-469f-a165-70867728950e";

function set_bridge_fragment(parentOrigin = HOST_ORIGIN, bridgeNonce = BRIDGE_NONCE) {
	window.history.replaceState(
		null,
		"",
		`/#${new URLSearchParams({ parentOrigin, bridgeNonce }).toString()}`,
	);
}

/** Simulates one host → page postMessage. */
function post_from_host(data: unknown, origin: string = HOST_ORIGIN, source: MessageEventSource = window): void {
	window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
}

function make_init(overrides?: Record<string, unknown>) {
	return {
		type: "bonobo:init",
		bridgeNonce: BRIDGE_NONCE,
		apiOrigin: "https://api.test",
		token: "plu_1",
		tokenExpiresAt: Date.now() + 600_000,
		context: {
			pluginName: "gallery",
			pageId: "main",
			pageTitle: "Gallery",
			organizationId: "org_1",
			workspaceId: "ws_1",
		},
		...overrides,
	};
}

/** happy-dom cannot deliver a real cross-origin parent postMessage, so record it directly. */
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
		bridgeNonce: BRIDGE_NONCE,
		requestId: request.requestId,
		token,
		tokenExpiresAt: Date.now() + 600_000,
		...overrides,
	});
	return request.requestId;
}

beforeEach(() => {
	set_bridge_fragment();
});

afterEach(() => {
	window.history.replaceState(null, "", "/");
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("bonobo_ui_connect", () => {
	test("rejects a missing or malformed host bridge fragment", async () => {
		window.history.replaceState(null, "", "/");
		await expect(bonobo_ui_connect()).rejects.toThrow("Missing host bridge fragment");

		set_bridge_fragment("ftp://host.test");
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge parent origin");

		set_bridge_fragment("https://host.test/");
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge parent origin");

		set_bridge_fragment(HOST_ORIGIN, "not-a-uuid");
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge nonce");

		window.history.replaceState(
			null,
			"",
			`/#${new URLSearchParams({ parentOrigin: HOST_ORIGIN, bridgeNonce: BRIDGE_NONCE, extra: "value" })}`,
		);
		await expect(bonobo_ui_connect()).rejects.toThrow("Invalid host bridge fragment");
	});

	test("sends nonce-bound ready to the exact parent and accepts only its matching init", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		expect(postSpy).toHaveBeenCalledWith({ type: "bonobo:ready", bridgeNonce: BRIDGE_NONCE }, HOST_ORIGIN);

		post_from_host(make_init({ token: "plu_wrong_source" }), HOST_ORIGIN, {} as Window);
		post_from_host(make_init({ token: "plu_wrong_origin" }), "https://wrong-host.test");
		post_from_host(make_init({ bridgeNonce: crypto.randomUUID(), token: "plu_bad_nonce" }));
		post_from_host(make_init({ tokenExpiresAt: Number.NaN, token: "plu_bad_shape" }));
		post_from_host(make_init());
		const client = await clientPromise;

		expect(client.apiOrigin).toBe("https://api.test");
		expect(client.context.pageTitle).toBe("Gallery");
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
			bridgeNonce: BRIDGE_NONCE,
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
			bridgeNonce: BRIDGE_NONCE,
			requestId: request.requestId,
			token: "plu_ignored",
			tokenExpiresAt: Date.now() + 600_000,
		};

		post_from_host(reply, HOST_ORIGIN, {} as Window);
		post_from_host(reply, "https://wrong-host.test");
		post_from_host({ ...reply, bridgeNonce: "wrong_nonce" });
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
		const rejected = expect(firstRefresh).rejects.toThrow("Plugin page token refresh timed out");
		await vi.advanceTimersByTimeAsync(10_000);
		await rejected;

		const secondRefresh = client.refreshToken();
		expect(refresh_requests(postSpy)).toHaveLength(2);
		answer_refresh(postSpy, "plu_3");
		await expect(secondRefresh).resolves.toBe("plu_3");
	});
});
