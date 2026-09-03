/**
 * Type-level checks of the Convex surface a plugin gets from `bonobo_connect`.
 *
 * `pnpm run typecheck` compiles this file with `--strict`, the way a plugin compiles. Vitest never
 * runs it: typecheck mode is off in `vitest.config.ts`, and the run glob does not match
 * `*.test-d.ts`. Every line marked `@ts-expect-error` must fail to compile; if the generated types
 * ever stop rejecting it, tsc reports an unused directive and the check fails. A bare directive
 * accepts any error on its line, so keep each of those lines wrong in exactly one way.
 */
import { usePaginatedQuery, useQuery } from "convex/react";
import type { BonoboClient } from "bonobo-plugin-sdk/frontend";

declare const client: BonoboClient;

export function hooks_type_check() {
	// The paginated door compiles with the hook as is: no cast, and the item type is the app's
	// document type.
	const timeline = usePaginatedQuery(
		client.api.plugins_data.watch_documents_page,
		{ collection: "messages", keyPrefix: "c:general/" },
		{ initialNumItems: 100 },
	);
	const key: string = timeline.results[0]?.key ?? "";
	const status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted" = timeline.status;
	timeline.loadMore(100);

	// A capped read with the hook. `undefined` while loading, `null` when the door refused it.
	const cursors = useQuery(client.api.plugins_data.watch_documents, {
		collection: "cursors",
		keyPrefix: "me:user_1",
		limit: 1,
	});
	const truncated: boolean | null | undefined = cursors === null ? null : cursors?.truncated;

	// @ts-expect-error the capped read is not a paginated door.
	usePaginatedQuery(client.api.plugins_data.watch_documents, { collection: "messages" }, { initialNumItems: 100 });

	// @ts-expect-error `limit` is required by the door.
	useQuery(client.api.plugins_data.watch_documents, { collection: "cursors" });

	// @ts-expect-error the paginated door needs `paginationOpts`; the hook supplies it, a direct
	// call must pass it.
	client.convex.query(client.api.plugins_data.watch_documents_page, { collection: "messages" });

	return { key, status, truncated };
}

export async function direct_calls_type_check() {
	// The page status survives the generator: the door's return type is one `PaginationResult`.
	const page = await client.convex.query(client.api.plugins_data.watch_documents_page, {
		collection: "messages",
		paginationOpts: { numItems: 100, cursor: null },
	});
	const pageStatus: "SplitRecommended" | "SplitRequired" | null | undefined = page.pageStatus;

	// A subscription without a hook.
	const scopesWatch = client.convex.watchQuery(client.api.plugins_data.watch_my_scopes, {});
	const stop = scopesWatch.onUpdate(() => {
		const scopes = scopesWatch.localQueryResult();
		const scopeId: string = scopes?.[0]?.scopeId ?? "";
		return scopeId;
	});
	stop();

	// A one-shot read; the result narrows on the door's own refusal shape.
	const roster = await client.convex.query(client.api.plugins_data.list_members, { limit: 5 });
	if (roster !== null && roster.refusal === undefined) {
		const cursor: string | null = roster.cursor;
		return cursor;
	}

	// A write resolves the door's own Result.
	const written = await client.convex.mutation(client.api.plugins_data.user_put_owned_document, {
		collection: "cursors",
		key: "me",
		value: { at: 1 },
		expectedRevision: 0,
	});
	if (written._nay) {
		const message: string = written._nay.message;
		return message;
	}

	// An id the SDK hands out is already the `users` table id, so it reaches a door with no cast.
	void client.convex.query(client.api.plugins_data.resolve_member_display, { userIds: [client.context.userId] });

	// The session primitive.
	const expiresAt: number = client.session.expiresAt();
	const jwt: string | null = await client.session.fetchJwt({ forceRefreshToken: true });

	// @ts-expect-error `limit` is a number.
	void client.convex.query(client.api.plugins_data.list_members, { limit: "5" });

	// @ts-expect-error a plain string is not an id of the users table.
	void client.convex.query(client.api.plugins_data.resolve_member_display, { userIds: ["user_1"] });

	// @ts-expect-error there is no such door.
	void client.api.plugins_data.delete_everything;

	// @ts-expect-error the data wrapper left the SDK in 0.13.0.
	void client.data;

	return { pageStatus, expiresAt, jwt };
}
