/**
 * GENERATED FILE. Do not edit by hand.
 *
 * The public Convex functions a plugin frame may call on its own client, typed as the app
 * declares them. `packages/app/scripts/generate-plugin-sdk-types.ts` writes this file from the
 * app (`pnpm run generate:plugin-sdk-types`), and the app lint fails when it is stale.
 */
export type BonoboConvexApi = {
	plugins_data: {
		user_append_document: import("convex/server").FunctionReference<"mutation", "public", {
			keyPrefix?: string | undefined;
			value: Record<string, any>;
			collection: string;
			clientRequestId: string;
		}, {
			_nay: {
				name: undefined;
				message: "Collection names must not be empty" | "Keys must not be empty" | "Idempotency keys must not be empty" | "Scope ids must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must be at most 128 characters" | "Keys must be at most 128 characters" | "Idempotency keys must be at most 128 characters" | "Scope ids must be at most 128 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not start or end with whitespace" | "Keys must not start or end with whitespace" | "Idempotency keys must not start or end with whitespace" | "Scope ids must not start or end with whitespace";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not contain control characters" | "Keys must not contain control characters" | "Idempotency keys must not contain control characters" | "Scope ids must not contain control characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Permission denied";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin has used its 16 MiB of storage";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `This plugin has used its ${number} document slots`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin can use at most 16 collections";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `You have used your ${string} MiB share of this plugin's storage`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You have used your 3000 document slots in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You can create at most 8 collections in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Key prefixes must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Key prefixes must be at most 109 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Key prefixes must contain only printable ASCII characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Plugin document values must be at most 16 KiB";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthenticated";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthorized";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Rate limit exceeded";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Not found";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "This collection is not user-writable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This idempotency key was already used for a different write";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "Could not assign a unique key, try again";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly key: string;
				readonly revision: number;
				readonly byteSize: number;
			};
			_nay?: undefined;
		}, string | undefined>;
		user_put_document: import("convex/server").FunctionReference<"mutation", "public", {
			expectedRevision?: number | undefined;
			value: Record<string, any>;
			collection: string;
			key: string;
		}, {
			_nay: {
				name: undefined;
				message: "Collection names must not be empty" | "Keys must not be empty" | "Idempotency keys must not be empty" | "Scope ids must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must be at most 128 characters" | "Keys must be at most 128 characters" | "Idempotency keys must be at most 128 characters" | "Scope ids must be at most 128 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not start or end with whitespace" | "Keys must not start or end with whitespace" | "Idempotency keys must not start or end with whitespace" | "Scope ids must not start or end with whitespace";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not contain control characters" | "Keys must not contain control characters" | "Idempotency keys must not contain control characters" | "Scope ids must not contain control characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Permission denied";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin has used its 16 MiB of storage";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `This plugin has used its ${number} document slots`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin can use at most 16 collections";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `You have used your ${string} MiB share of this plugin's storage`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You have used your 3000 document slots in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You can create at most 8 collections in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Plugin document values must be at most 16 KiB";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthenticated";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthorized";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Rate limit exceeded";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Not found";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "This collection is not user-writable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				revision: number;
				byteSize: number;
			};
			_nay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document is written by a service and cannot be changed here";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document belongs to another writer";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Expected revisions must be non-negative integers";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document changed since it was read";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		}, string | undefined>;
		user_remove_document: import("convex/server").FunctionReference<"mutation", "public", {
			expectedRevision?: number | undefined;
			collection: string;
			key: string;
		}, {
			_nay: {
				name: undefined;
				message: "Collection names must not be empty" | "Keys must not be empty" | "Idempotency keys must not be empty" | "Scope ids must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must be at most 128 characters" | "Keys must be at most 128 characters" | "Idempotency keys must be at most 128 characters" | "Scope ids must be at most 128 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not start or end with whitespace" | "Keys must not start or end with whitespace" | "Idempotency keys must not start or end with whitespace" | "Scope ids must not start or end with whitespace";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not contain control characters" | "Keys must not contain control characters" | "Idempotency keys must not contain control characters" | "Scope ids must not contain control characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Permission denied";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthenticated";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthorized";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Rate limit exceeded";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Not found";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "This collection is not user-writable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Expected revisions must be non-negative integers";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document changed since it was read";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document is written by a service and cannot be changed here";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly deleted: false;
			};
			_nay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document belongs to another writer";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly deleted: true;
			};
			_nay?: undefined;
		}, string | undefined>;
		user_put_owned_document: import("convex/server").FunctionReference<"mutation", "public", {
			expectedRevision?: number | undefined;
			value: Record<string, any>;
			collection: string;
			key: string;
		}, {
			_nay: {
				name: undefined;
				message: "Collection names must not be empty" | "Keys must not be empty" | "Idempotency keys must not be empty" | "Scope ids must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must be at most 128 characters" | "Keys must be at most 128 characters" | "Idempotency keys must be at most 128 characters" | "Scope ids must be at most 128 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not start or end with whitespace" | "Keys must not start or end with whitespace" | "Idempotency keys must not start or end with whitespace" | "Scope ids must not start or end with whitespace";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not contain control characters" | "Keys must not contain control characters" | "Idempotency keys must not contain control characters" | "Scope ids must not contain control characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Permission denied";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin has used its 16 MiB of storage";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `This plugin has used its ${number} document slots`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin can use at most 16 collections";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `You have used your ${string} MiB share of this plugin's storage`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You have used your 3000 document slots in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You can create at most 8 collections in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Plugin document values must be at most 16 KiB";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthenticated";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthorized";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Rate limit exceeded";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Not found";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "This collection is not user-writable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Expected revisions must be non-negative integers";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document changed since it was read";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document is written by a service and cannot be changed here";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Keys must be at most 128 characters after the writer id is appended";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document belongs to another writer";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly key: string;
				readonly revision: number;
				readonly byteSize: number;
			};
			_nay?: undefined;
		}, string | undefined>;
		user_remove_owned_document: import("convex/server").FunctionReference<"mutation", "public", {
			expectedRevision?: number | undefined;
			collection: string;
			key: string;
		}, {
			_nay: {
				name: undefined;
				message: "Collection names must not be empty" | "Keys must not be empty" | "Idempotency keys must not be empty" | "Scope ids must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must be at most 128 characters" | "Keys must be at most 128 characters" | "Idempotency keys must be at most 128 characters" | "Scope ids must be at most 128 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not start or end with whitespace" | "Keys must not start or end with whitespace" | "Idempotency keys must not start or end with whitespace" | "Scope ids must not start or end with whitespace";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not contain control characters" | "Keys must not contain control characters" | "Idempotency keys must not contain control characters" | "Scope ids must not contain control characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Permission denied";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthenticated";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthorized";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Rate limit exceeded";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Not found";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "This collection is not user-writable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Expected revisions must be non-negative integers";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document changed since it was read";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Keys must be at most 128 characters after the writer id is appended";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly deleted: false;
			};
			_nay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This document belongs to another writer";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly deleted: true;
			};
			_nay?: undefined;
		}, string | undefined>;
		user_manage_scope: import("convex/server").FunctionReference<"mutation", "public", {
			action: {
				kind: "create";
				scopeId: string;
				keyPrefix: string;
				collections: string[];
			} | {
				kind: "create_with_document";
				scopeId: string;
				keyPrefix: string;
				document: {
					value: Record<string, any>;
					collection: string;
					key: string;
				};
				collections: string[];
				principals: {
					userId: import("convex/values").GenericId<"users">;
					level: "member" | "manage";
				}[];
			} | {
				kind: "set_principal";
				userId: import("convex/values").GenericId<"users">;
				scopeId: string;
				level: "member" | "manage";
			} | {
				expectedPrincipalCount?: number | undefined;
				kind: "remove_principal";
				userId: import("convex/values").GenericId<"users">;
				scopeId: string;
			} | {
				expectedPrincipalCount?: number | undefined;
				kind: "delete";
				scopeId: string;
			};
		}, {
			_nay: {
				name: undefined;
				message: "Collection names must not be empty" | "Keys must not be empty" | "Idempotency keys must not be empty" | "Scope ids must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must be at most 128 characters" | "Keys must be at most 128 characters" | "Idempotency keys must be at most 128 characters" | "Scope ids must be at most 128 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not start or end with whitespace" | "Keys must not start or end with whitespace" | "Idempotency keys must not start or end with whitespace" | "Scope ids must not start or end with whitespace";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Collection names must not contain control characters" | "Keys must not contain control characters" | "Idempotency keys must not contain control characters" | "Scope ids must not contain control characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin has used its 16 MiB of storage";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `This plugin has used its ${number} document slots`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin can use at most 16 collections";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: `You have used your ${string} MiB share of this plugin's storage`;
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You have used your 3000 document slots in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "You can create at most 8 collections in this plugin";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Key prefixes must not be empty";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Key prefixes must be at most 109 characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Key prefixes must contain only printable ASCII characters";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Plugin document values must be at most 16 KiB";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthenticated";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Unauthorized";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Rate limit exceeded";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Not found";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Permission denied";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "This collection is not user-writable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This scope id is unavailable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Name at least one collection for this scope";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "One scope can cover at most 16 collections";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "One private space can name at most 50 people.";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "The creator is already included with manage access";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Name each private-space member once";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "The first document must be inside the new scope";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This scope id already covers a different key range";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly scopeId: string;
				readonly deleted: false;
				readonly membershipRevision: number;
			};
			_nay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This scope id already has a different setup";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "Another scope already covers part of this key range" | "This key range is unavailable";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "This key range is already in use";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "You are already in 50 private spaces, which is the most you can be in. Leave one first." | "This member is already in 50 private spaces, which is the most they can be in. Ask them to leave one first.";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "storage_full";
				message: "This plugin has already created 1000 private spaces, which is its lifetime limit. Reinstall it to start over.";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: "conflict";
				message: "The private space membership changed. Try again.";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_yay: {
				readonly scopeId: string;
				readonly deleted: true;
				readonly membershipRevision: number;
			};
			_nay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "The last person must leave this private space themselves";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "You cannot lower your own private space access";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		} | {
			_nay: {
				name: undefined;
				message: "Add another person before lowering the last manager's access";
				cause: never;
				data: never;
				stack?: string;
			};
			_yay?: undefined;
		}, string | undefined>;
		watch_scope_principals: import("convex/server").FunctionReference<"query", "public", {
			scopeId: string;
		}, {
			userId: import("convex/values").GenericId<"users">;
			level: "member" | "manage";
		}[] | null, string | undefined>;
		watch_my_scopes: import("convex/server").FunctionReference<"query", "public", {}, {
			scopeId: string;
			keyPrefix: string;
			collections: string[];
			appendActivity: {
				collection: string;
				at: number;
				createdByUserId: string;
				sequence: number;
			}[];
			level: "member" | "manage";
			membershipRevision: number;
		}[] | null, string | undefined>;
		watch_documents: import("convex/server").FunctionReference<"query", "public", {
			keyPrefix?: string | undefined;
			keyStartExclusive?: string | undefined;
			keyEndInclusive?: string | undefined;
			collection: string;
			limit: number;
		}, {
			docs: {
				createdBy: import("convex/values").GenericId<"users">;
				updatedBy: import("convex/values").GenericId<"users">;
				updatedAt: number;
				createdAt: number;
				value: Record<string, any>;
				collection: string;
				key: string;
				byteSize: number;
				revision: number;
				writeMode: "normal" | "versioned";
				ownership: "shared" | "owned";
			}[];
			truncated: boolean;
		} | null, string | undefined>;
		watch_recent: import("convex/server").FunctionReference<"query", "public", {
			scopeId?: string | undefined;
			order?: "asc" | "desc" | undefined;
			before?: number | undefined;
			since?: number | undefined;
			collection: string;
			limit: number;
		}, {
			docs: {
				createdBy: import("convex/values").GenericId<"users">;
				updatedBy: import("convex/values").GenericId<"users">;
				updatedAt: number;
				createdAt: number;
				value: Record<string, any>;
				collection: string;
				key: string;
				byteSize: number;
				revision: number;
				writeMode: "normal" | "versioned";
				ownership: "shared" | "owned";
			}[];
			truncated: boolean;
		} | null, string | undefined>;
		watch_changes: import("convex/server").FunctionReference<"query", "public", {
			scopeId?: string | undefined;
			updatedSince?: number | undefined;
			collection: string;
			limit: number;
		}, {
			docs: {
				createdBy: import("convex/values").GenericId<"users">;
				updatedBy: import("convex/values").GenericId<"users">;
				updatedAt: number;
				createdAt: number;
				value: Record<string, any>;
				collection: string;
				key: string;
				byteSize: number;
				revision: number;
				writeMode: "normal" | "versioned";
				ownership: "shared" | "owned";
			}[];
			truncated: boolean;
		} | null, string | undefined>;
		resolve_member_display: import("convex/server").FunctionReference<"query", "public", {
			userIds: import("convex/values").GenericId<"users">[];
		}, {
			members: Record<import("convex/values").GenericId<"users">, string | null>;
		} | null, string | undefined>;
		list_members: import("convex/server").FunctionReference<"query", "public", {
			cursor?: string | null | undefined;
			limit: number;
		}, {
			refusal: "not_consented";
			members?: undefined;
			cursor?: undefined;
		} | {
			members: {
				userId: import("convex/values").GenericId<"users">;
				displayName: string | null;
			}[];
			cursor: string | null;
			refusal?: undefined;
		} | null, string | undefined>;
	};
};
