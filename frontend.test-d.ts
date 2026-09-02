/**
 * Type-level checks of the direct Convex surface a plugin gets from `bonobo_ui_connect`.
 *
 * `pnpm run typecheck` compiles this file with `--strict`, the way a plugin compiles. Vitest never
 * runs it: typecheck mode is off in `vitest.config.ts`, and the run glob does not match
 * `*.test-d.ts`. Every line marked `@ts-expect-error` must fail to compile; if the generated types
 * ever stop rejecting it, tsc reports an unused directive and the check fails. A bare directive
 * accepts any error on its line, so keep each of those lines wrong in exactly one way.
 */
import type { BonoboUiFrontendClient, BonoboUserId } from "bonobo-plugin-sdk/frontend";

declare const client: BonoboUiFrontendClient;

export async function direct_calls_type_check() {
	// A correct subscription: the arguments and the delivered value come from the app's types.
	const unsubscribe = client.convex.onUpdate(
		client.api.plugins_data.watch_documents,
		{ collection: "cursors", keyPrefix: "me:user_1", limit: 1 },
		(result) => {
			if (result === null) {
				return;
			}
			const key: string = result.docs[0]?.key ?? "";
			const truncated: boolean = result.truncated;
			return { key, truncated };
		},
	);
	unsubscribe();

	// A correct one-shot read; the result narrows on the door's own refusal shape.
	const page = await client.convex.query(client.api.plugins_data.list_members, { limit: 5 });
	if (page !== null && page.refusal === undefined) {
		const cursor: string | null = page.cursor;
		return cursor;
	}

	// A plain id from the SDK reaches a door through the exported id type.
	void client.convex.query(client.api.plugins_data.resolve_member_display, { userIds: ["user_1" as BonoboUserId] });

	// @ts-expect-error `limit` is required by the door.
	client.convex.onUpdate(client.api.plugins_data.watch_documents, { collection: "cursors" }, () => {});

	// @ts-expect-error `limit` is a number.
	void client.convex.query(client.api.plugins_data.list_members, { limit: "5" });

	// @ts-expect-error a plain string is not an id of the users table.
	void client.convex.query(client.api.plugins_data.resolve_member_display, { userIds: ["user_1"] });

	// @ts-expect-error there is no such door.
	void client.api.plugins_data.delete_everything;

	return null;
}
