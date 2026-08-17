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

/** happy-dom cannot deliver a real cross-origin parent postMessage, so record it directly. */
function spy_on_post_message() {
	return vi.spyOn(window, "postMessage").mockImplementation(() => {});
}

function refresh_requests(postSpy: ReturnType<typeof spy_on_post_message>) {
	return postSpy.mock.calls.filter((call) => (call[0] as { type?: string }).type === "bonobo:token-refresh-request");
}

function posted_messages(postSpy: ReturnType<typeof spy_on_post_message>, type: string) {
	return postSpy.mock.calls
		.filter((call) => (call[0] as { type?: string }).type === type)
		.map((call) => call[0] as Record<string, unknown>);
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
		expect(client.context.kind === "page" && client.context.pageTitle).toBe("Gallery");
		await expect(client.getToken()).resolves.toBe("plu_1");
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

describe("data.watch", () => {
	test("delivers each update's docs for the matching subscription", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		client.data.watch({ collection: "messages", keyPrefix: "m:", limit: 100 }, onUpdate);
		const watchMessage = posted_messages(postSpy, "bonobo:data-watch").at(-1) as { subscriptionId: string };
		expect(watchMessage).toEqual({
			type: "bonobo:data-watch",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			collection: "messages",
			keyPrefix: "m:",
			limit: 100,
		});

		const firstDocs = [make_public_doc()];
		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: firstDocs,
		});
		const secondDocs = [make_public_doc(), make_public_doc({ key: "m:2" })];
		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: secondDocs,
		});

		expect(onUpdate).toHaveBeenNthCalledWith(1, firstDocs);
		expect(onUpdate).toHaveBeenNthCalledWith(2, secondDocs);
	});

	test("a null update kills the subscription and makes unsubscribe a no-op", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		const unsubscribe = client.data.watch({ collection: "messages", limit: 50 }, onUpdate);
		const watchMessage = posted_messages(postSpy, "bonobo:data-watch").at(-1) as { subscriptionId: string };
		expect("keyPrefix" in watchMessage).toBe(false);

		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: null,
		});
		expect(onUpdate).toHaveBeenNthCalledWith(1, null);

		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: [make_public_doc()],
		});
		expect(onUpdate).toHaveBeenCalledTimes(1);

		unsubscribe();
		expect(posted_messages(postSpy, "bonobo:data-unwatch")).toHaveLength(0);
	});

	test("unsubscribe posts unwatch once and stops delivery", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		const unsubscribe = client.data.watch({ collection: "messages", limit: 100 }, onUpdate);
		const watchMessage = posted_messages(postSpy, "bonobo:data-watch").at(-1) as { subscriptionId: string };

		unsubscribe();
		expect(posted_messages(postSpy, "bonobo:data-unwatch")).toEqual([
			{ type: "bonobo:data-unwatch", bridgeNonce: BRIDGE_NONCE, subscriptionId: watchMessage.subscriptionId },
		]);

		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: [make_public_doc()],
		});
		expect(onUpdate).not.toHaveBeenCalled();

		unsubscribe();
		expect(posted_messages(postSpy, "bonobo:data-unwatch")).toHaveLength(1);
	});

	test("a death passes the host's reason and message along, dropping non-string junk", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onExplained = vi.fn();
		client.data.watch({ collection: "messages", limit: 100 }, onExplained);
		const explainedWatch = posted_messages(postSpy, "bonobo:data-watch").at(-1) as { subscriptionId: string };
		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: explainedWatch.subscriptionId,
			docs: null,
			reason: "invalid",
			message: "Collection names must be 1-128 printable ASCII characters",
		});
		expect(onExplained).toHaveBeenNthCalledWith(1, null, {
			reason: "invalid",
			message: "Collection names must be 1-128 printable ASCII characters",
		});

		// Non-string reason/message fields are junk, not an explanation: deliver a bare death.
		const onJunk = vi.fn();
		client.data.watch({ collection: "messages", limit: 100 }, onJunk);
		const junkWatch = posted_messages(postSpy, "bonobo:data-watch").at(-1) as { subscriptionId: string };
		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: junkWatch.subscriptionId,
			docs: null,
			reason: 42,
			message: { text: "nope" },
		});
		expect(onJunk).toHaveBeenNthCalledWith(1, null);
	});

	test("ignores updates with the wrong source, origin, nonce, or an unknown subscription", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		client.data.watch({ collection: "messages", limit: 100 }, onUpdate);
		const watchMessage = posted_messages(postSpy, "bonobo:data-watch").at(-1) as { subscriptionId: string };
		const update = {
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: [make_public_doc()],
		};

		post_from_host(update, HOST_ORIGIN, {} as Window);
		post_from_host(update, "https://wrong-host.test");
		post_from_host({ ...update, bridgeNonce: crypto.randomUUID() });
		post_from_host({ ...update, subscriptionId: crypto.randomUUID() });
		expect(onUpdate).not.toHaveBeenCalled();

		post_from_host(update);
		expect(onUpdate).toHaveBeenNthCalledWith(1, update.docs);
	});
});

describe("data.watchWindow", () => {
	test("posts the window wire shape and coerces update flags to booleans", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		client.data.watchWindow({ collection: "messages", keyPrefix: "m:", pageSize: 50 }, onUpdate);
		const watchMessage = posted_messages(postSpy, "bonobo:data-watch-window").at(-1) as { subscriptionId: string };
		expect(watchMessage).toEqual({
			type: "bonobo:data-watch-window",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			collection: "messages",
			keyPrefix: "m:",
			pageSize: 50,
		});

		const docs = [make_public_doc()];
		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs,
			hasMore: true,
			atCapacity: false,
			incomplete: false,
		});
		expect(onUpdate).toHaveBeenNthCalledWith(1, { docs, hasMore: true, atCapacity: false, incomplete: false });

		// Flags that are missing or not real booleans must coerce to false, never leak through.
		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs,
			hasMore: "yes",
		});
		expect(onUpdate).toHaveBeenNthCalledWith(2, { docs, hasMore: false, atCapacity: false, incomplete: false });
	});

	test("loadOlder posts while live and goes inert after death or unsubscribe", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		const first = client.data.watchWindow({ collection: "messages", pageSize: 100 }, onUpdate);
		const firstWatch = posted_messages(postSpy, "bonobo:data-watch-window").at(-1) as { subscriptionId: string };
		expect("keyPrefix" in firstWatch).toBe(false);

		first.loadOlder();
		expect(posted_messages(postSpy, "bonobo:data-window-load-older")).toEqual([
			{ type: "bonobo:data-window-load-older", bridgeNonce: BRIDGE_NONCE, subscriptionId: firstWatch.subscriptionId },
		]);

		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: firstWatch.subscriptionId,
			docs: null,
		});
		expect(onUpdate).toHaveBeenNthCalledWith(1, null);

		// After the death the registration is gone: loadOlder posts nothing and unsubscribe
		// must not tell the host to drop a subscription it already dropped.
		first.loadOlder();
		first.unsubscribe();
		expect(posted_messages(postSpy, "bonobo:data-window-load-older")).toHaveLength(1);
		expect(posted_messages(postSpy, "bonobo:data-unwatch")).toHaveLength(0);

		const second = client.data.watchWindow({ collection: "messages", pageSize: 100 }, vi.fn());
		second.unsubscribe();
		expect(posted_messages(postSpy, "bonobo:data-unwatch")).toHaveLength(1);
		second.loadOlder();
		second.unsubscribe();
		expect(posted_messages(postSpy, "bonobo:data-window-load-older")).toHaveLength(1);
		expect(posted_messages(postSpy, "bonobo:data-unwatch")).toHaveLength(1);
	});

	test("a window death delivers null once with the host's reason", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const onUpdate = vi.fn();
		client.data.watchWindow({ collection: "messages", pageSize: 10 }, onUpdate);
		const watchMessage = posted_messages(postSpy, "bonobo:data-watch-window").at(-1) as { subscriptionId: string };

		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: null,
			reason: "budget",
			message: "The watch start budget is exhausted",
		});
		expect(onUpdate).toHaveBeenNthCalledWith(1, null, {
			reason: "budget",
			message: "The watch start budget is exhausted",
		});

		post_from_host({
			type: "bonobo:data-update",
			bridgeNonce: BRIDGE_NONCE,
			subscriptionId: watchMessage.subscriptionId,
			docs: [make_public_doc()],
			hasMore: false,
			atCapacity: false,
			incomplete: false,
		});
		expect(onUpdate).toHaveBeenCalledTimes(1);
	});
});

describe("data writes", () => {
	test("correlates two concurrent writes to their own results", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const put = client.data.put({ collection: "messages", key: "m:1", value: { body: "hi" } });
		const append = client.data.append({
			collection: "replies",
			keyPrefix: "r:",
			value: { body: "yo" },
			clientRequestId: "req_1",
		});
		const writes = posted_messages(postSpy, "bonobo:data-user-write") as Array<{ requestId: string }>;
		expect(writes).toHaveLength(2);
		expect(writes[0]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[0]?.requestId,
			op: "put",
			collection: "messages",
			key: "m:1",
			value: { body: "hi" },
		});
		expect(writes[1]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[1]?.requestId,
			op: "append",
			collection: "replies",
			keyPrefix: "r:",
			value: { body: "yo" },
			clientRequestId: "req_1",
		});
		expect(writes[0]?.requestId).not.toBe(writes[1]?.requestId);

		// Answer in reverse order so a correlation mix-up cannot pass by accident.
		post_from_host({
			type: "bonobo:data-user-write-result",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[1]?.requestId,
			result: { _yay: { key: "r:2" } },
		});
		post_from_host({
			type: "bonobo:data-user-write-result",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[0]?.requestId,
			result: { _nay: { message: "Permission denied" } },
		});

		await expect(append).resolves.toEqual({ _yay: { key: "r:2" } });
		await expect(put).resolves.toEqual({ _nay: { message: "Permission denied" } });
	});

	test("remove, putOwned, and removeOwned post their exact wire shape", async () => {
		// The host maps `op` straight to a mutation, so a missing or extra field here
		// changes which door runs. Pin the full posted payload for the three ops the
		// correlation tests above do not already pin.
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		void client.data.remove({ collection: "messages", key: "m:1" });
		void client.data.putOwned({ collection: "reactions", key: "m:1:heart", value: { on: true } });
		void client.data.removeOwned({ collection: "reactions", key: "m:1:heart" });

		const writes = posted_messages(postSpy, "bonobo:data-user-write") as Array<{ requestId: string }>;
		expect(writes).toHaveLength(3);
		expect(writes[0]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[0]?.requestId,
			op: "remove",
			collection: "messages",
			key: "m:1",
		});
		expect(writes[1]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[1]?.requestId,
			op: "putOwned",
			collection: "reactions",
			key: "m:1:heart",
			value: { on: true },
		});
		expect(writes[2]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[2]?.requestId,
			op: "removeOwned",
			collection: "reactions",
			key: "m:1:heart",
		});
	});

	test("expectedRevision rides put, remove, putOwned, and removeOwned when given", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		void client.data.put({ collection: "channels", key: "c:1", value: { name: "general" }, expectedRevision: 3 });
		void client.data.remove({ collection: "channels", key: "c:1", expectedRevision: 4 });
		void client.data.putOwned({ collection: "profiles", key: "status", value: { text: "hi" }, expectedRevision: 0 });
		void client.data.removeOwned({ collection: "profiles", key: "status", expectedRevision: 1 });

		const writes = posted_messages(postSpy, "bonobo:data-user-write") as Array<{ requestId: string }>;
		expect(writes).toHaveLength(4);
		expect(writes[0]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[0]?.requestId,
			op: "put",
			collection: "channels",
			key: "c:1",
			value: { name: "general" },
			expectedRevision: 3,
		});
		expect(writes[1]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[1]?.requestId,
			op: "remove",
			collection: "channels",
			key: "c:1",
			expectedRevision: 4,
		});
		// expectedRevision 0 means "the key must not exist yet" and must reach the wire, not be
		// dropped as falsy.
		expect(writes[2]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[2]?.requestId,
			op: "putOwned",
			collection: "profiles",
			key: "status",
			value: { text: "hi" },
			expectedRevision: 0,
		});
		expect(writes[3]).toEqual({
			type: "bonobo:data-user-write",
			bridgeNonce: BRIDGE_NONCE,
			requestId: writes[3]?.requestId,
			op: "removeOwned",
			collection: "profiles",
			key: "status",
			expectedRevision: 1,
		});
	});

	test("rejects a write the host never answers after ten seconds", async () => {
		vi.useFakeTimers();
		spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const write = client.data.remove({ collection: "messages", key: "m:1" });
		const rejected = expect(write).rejects.toThrow("Plugin data write timed out");
		await vi.advanceTimersByTimeAsync(10_000);
		await rejected;
	});

	test("ignores write results with the wrong source, origin, or nonce", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const write = client.data.putOwned({ collection: "profiles", key: "status", value: { text: "away" } });
		const request = posted_messages(postSpy, "bonobo:data-user-write").at(-1) as { requestId: string };
		const result = {
			type: "bonobo:data-user-write-result",
			bridgeNonce: BRIDGE_NONCE,
			requestId: request.requestId,
			result: { _yay: { key: "status:user_1" } },
		};

		post_from_host(result, HOST_ORIGIN, {} as Window);
		post_from_host(result, "https://wrong-host.test");
		post_from_host({ ...result, bridgeNonce: crypto.randomUUID() });
		let settled = false;
		void write.finally(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		post_from_host(result);
		await expect(write).resolves.toEqual({ _yay: { key: "status:user_1" } });
	});
});

describe("members.resolve", () => {
	test("round-trips user ids to the host's member map", async () => {
		const postSpy = spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const resolveMembers = client.members.resolve(["user_1", "user_gone"]);
		const request = posted_messages(postSpy, "bonobo:data-resolve-members").at(-1) as { requestId: string };
		expect(request).toEqual({
			type: "bonobo:data-resolve-members",
			bridgeNonce: BRIDGE_NONCE,
			requestId: request.requestId,
			userIds: ["user_1", "user_gone"],
		});

		post_from_host({
			type: "bonobo:data-resolve-members-result",
			bridgeNonce: BRIDGE_NONCE,
			requestId: request.requestId,
			members: { user_1: "Ray", user_gone: null },
		});
		await expect(resolveMembers).resolves.toEqual({ user_1: "Ray", user_gone: null });
	});

	test("rejects a resolve the host never answers after ten seconds", async () => {
		vi.useFakeTimers();
		spy_on_post_message();
		const clientPromise = bonobo_ui_connect();
		post_from_host(make_init());
		const client = await clientPromise;

		const resolveMembers = client.members.resolve(["user_1"]);
		const rejected = expect(resolveMembers).rejects.toThrow("Plugin member resolve timed out");
		await vi.advanceTimersByTimeAsync(10_000);
		await rejected;
	});
});
