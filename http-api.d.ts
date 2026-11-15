/**
 * GENERATED FILE. Do not edit by hand.
 *
 * The host HTTP routes a plugin may call, typed as the app declares them: the request body of
 * each route, and the body of every status it answers.
 *
 * `packages/app/scripts/generate-plugin-sdk-types.ts` writes this file from the app
 * (`pnpm run generate:plugin-sdk-types`), and the app lint fails when it is stale.
 */
export type BonoboHttpApi = {
	"/api/v1/plugin-data/read": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				collection: string;
				key: string;
				installationId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						document: {
							createdBy: import("convex/values").GenericId<"users">;
							updatedBy: import("convex/values").GenericId<"users">;
							updatedAt: number;
							value: {
								[x: string]: any;
							};
							createdAt: number;
							key: string;
							revision: number;
							byteSize: number;
							collection: string;
							writeMode: "normal" | "versioned";
							ownership: "shared" | "owned";
						} | null;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: string;
						errorCode: "storage_full";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugin-data/list": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				collection: string;
				keyPrefix?: string | undefined;
				keyStartExclusive?: string | undefined;
				keyEndInclusive?: string | undefined;
				cursor?: string | null | undefined;
				limit?: number | undefined;
				installationId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						documents: {
							createdBy: import("convex/values").GenericId<"users">;
							updatedBy: import("convex/values").GenericId<"users">;
							updatedAt: number;
							value: {
								[x: string]: any;
							};
							createdAt: number;
							key: string;
							revision: number;
							byteSize: number;
							collection: string;
							writeMode: "normal" | "versioned";
							ownership: "shared" | "owned";
						}[];
						cursor: string | null;
						isDone: boolean;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: "cursor is not a cursor this route issued";
						errorCode: "invalid_cursor";
					} | {
						message: "cursor was issued for a different installationId. Start a new page instead of reusing it." | "cursor was issued for a different route. Start a new page instead of reusing it." | "cursor was issued for a different collection. Start a new page instead of reusing it." | "cursor was issued for a different keyPrefix. Start a new page instead of reusing it." | "cursor was issued for a different keyStartExclusive. Start a new page instead of reusing it." | "cursor was issued for a different keyEndInclusive. Start a new page instead of reusing it.";
						errorCode: "invalid_cursor";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: string;
						errorCode: "storage_full";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugin-data/write": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				collection: string;
				key: string;
				value: {
					[x: string]: unknown;
				};
				installationId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						revision: number;
						byteSize: number;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: string;
						errorCode: "storage_full";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugin-data/write-batch": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				documents: {
					collection: string;
					key: string;
					value: {
						[x: string]: unknown;
					};
				}[];
				installationId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						documents: {
							collection: string;
							key: string;
							revision: number;
							byteSize: number;
						}[];
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: string;
						errorCode: "storage_full";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugin-data/delete": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				collection: string;
				key: string;
				installationId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						deleted: boolean;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: string;
						errorCode: "storage_full";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/restore": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				force?: boolean | undefined;
				paths?: string[] | undefined;
				nodes?: {
					nodeId: string;
					archiveOperationId: string;
				}[] | undefined;
				onConflict?: "skip" | "keep_both" | undefined;
				dryRun?: boolean | undefined;
				requestId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						jobIds: import("convex/values").GenericId<"activities">[];
						isDone: boolean;
						refused: ({
							path: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
						} | {
							path: string | null;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
							nodeId: string;
						})[] | ({
							path: string | null;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
							nodeId: string;
						} | {
							path: null;
							message: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
						})[];
					} | {
						dryRun: true;
						complete: boolean;
						refused: ({
							path: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
						} | {
							path: string | null;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
							nodeId: string;
						})[] | ({
							path: string | null;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
							nodeId: string;
						} | {
							path: null;
							message: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
						})[];
						jobs: ({
							kind: "copy" | "move" | "restore" | "delete";
							status: "running" | "stopping" | "partial" | "succeeded" | "failed" | "queued" | "canceled" | "timed_out" | "awaiting_input";
							errorMessage: string | null;
							progress: {
								failed: number;
								canceled: number;
								completed: number;
								blocked: number;
								skipped: number;
								unit: "items" | "files";
								discovered: number;
								total: number | null;
							} | undefined;
							refused: {
								path: string;
								errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
								message: string;
							}[] | {
								path: string | null;
								message: string;
								errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							}[];
							renamed: {
								path: string;
								newPath: string;
							}[] | {
								path: string;
								newPath: string;
							}[];
							hasMoreItems: boolean;
						} | {
							kind: "restore";
							status: "running" | "stopping" | "partial" | "succeeded" | "failed" | "queued" | "canceled" | "timed_out" | "awaiting_input";
							errorMessage: string | null;
							progress: {
								failed: number;
								canceled: number;
								completed: number;
								blocked: number;
								skipped: number;
								unit: "items" | "files";
								discovered: number;
								total: number | null;
							} | undefined;
							refused: ({
								path: string | null;
								errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
								message: string;
								nodeId: string;
							} | {
								path: null;
								message: string;
								errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							} | {
								path: string | null;
								message: string;
								errorCode: "conflict";
							})[];
							renamed: {
								path: string | null;
								newPath: string | null;
							}[];
							hasMoreItems: boolean;
						})[];
						message?: undefined;
						errorCode?: undefined;
						nodeId?: undefined;
						path?: undefined;
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						nodeId?: undefined;
						path?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					} | {
						message: "Duplicate node in batch";
						errorCode: "invalid_input";
						nodeId: string;
						path?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					} | {
						message: "Path must be absolute.";
						errorCode: "invalid_input";
						path: string;
						nodeId?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					} | {
						message: "Path must not be the workspace root.";
						errorCode: "invalid_input";
						path: string;
						nodeId?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					} | {
						message: "Duplicate path in batch";
						errorCode: "invalid_input";
						path: string;
						nodeId?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "permission_denied";
						nodeId?: undefined;
						path?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "request_id_reused";
						nodeId?: undefined;
						path?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "unauthenticated";
						nodeId?: undefined;
						path?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
						nodeId?: undefined;
						path?: undefined;
						dryRun?: undefined;
						complete?: undefined;
						refused?: undefined;
						jobs?: undefined;
					} | {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/trash/list": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				areaNodeId?: string | null | undefined;
				folderNodeId?: string | undefined;
				cursor?: string | null | undefined;
				limit?: number | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						items: {
							path: string;
							name: string;
							kind: "file" | "folder";
							nodeId: import("convex/values").GenericId<"files_nodes">;
							contentType: string | null;
							updatedAt: number;
							size: number | null;
							locked: boolean;
							archiveOperationId: string;
							operationAt: number;
							changedBy: import("convex/values").GenericId<"users"> | "SYSTEM" | null;
							top: boolean;
						}[];
						cursor: string | null;
						isDone: boolean;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: string;
						errorCode: "invalid_cursor";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/trash/areas": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				cursor?: string | null | undefined;
				limit?: number | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						areas: ({
							areaNodeId: string | null;
							path: string;
						} | {
							areaNodeId: null;
							path: string;
						})[];
						cursor: string | null;
						isDone: boolean;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: string;
						errorCode: "invalid_cursor";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/jobs/get": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				jobId: string;
				cursor?: string | null | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						jobId: import("convex/values").GenericId<"activities">;
						kind: "copy" | "move";
						status: "running" | "stopping" | "partial" | "succeeded" | "failed" | "queued" | "canceled" | "timed_out" | "awaiting_input";
						progress: {
							failed: number;
							canceled: number;
							completed: number;
							blocked: number;
							skipped: number;
							unit: "items" | "files";
							discovered: number;
							total: number | null;
						} | undefined;
						errorMessage: string | null;
						refused: {
							path: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
						}[];
						renamed: {
							path: string;
							newPath: string;
						}[];
						refusedCursor: string | null;
					} | {
						jobId: import("convex/values").GenericId<"activities">;
						kind: "restore" | "delete";
						status: "running" | "stopping" | "partial" | "succeeded" | "failed" | "queued" | "canceled" | "timed_out" | "awaiting_input";
						progress: {
							failed: number;
							canceled: number;
							completed: number;
							blocked: number;
							skipped: number;
							unit: "items" | "files";
							discovered: number;
							total: number | null;
						} | undefined;
						errorMessage: string | null;
						refused: {
							path: string | null;
							message: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
						}[];
						renamed: {
							path: string;
							newPath: string;
						}[];
						refusedCursor: string | null;
					} | {
						refusedCursor: string | null;
						jobId: import("convex/values").GenericId<"activities">;
						kind: "restore";
						status: "running" | "stopping" | "partial" | "succeeded" | "failed" | "queued" | "canceled" | "timed_out" | "awaiting_input";
						progress: {
							failed: number;
							canceled: number;
							completed: number;
							blocked: number;
							skipped: number;
							unit: "items" | "files";
							discovered: number;
							total: number | null;
						} | undefined;
						errorMessage: string | null;
						refused: ({
							path: string | null;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
							message: string;
							nodeId: string;
						} | {
							path: null;
							message: string;
							errorCode: "permission_denied" | "not_found" | "read_only" | "path_busy" | "move_busy" | "conflict";
						} | {
							path: string | null;
							message: string;
							errorCode: "conflict";
						})[];
						renamed: {
							path: string | null;
							newPath: string | null;
						}[];
						message?: undefined;
						errorCode?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: "This job cursor changed. Start a new page.";
						errorCode: "invalid_cursor";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: "Permission denied";
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Job not found";
						errorCode: "not_found";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/list": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				path?: string | undefined;
				cursor?: string | null | undefined;
				limit?: number | undefined;
				scanLimit?: number | undefined;
				recursive?: boolean | undefined;
				kind?: "file" | "folder" | undefined;
				extension?: string | undefined;
				contentTypePrefixes?: string[] | undefined;
				order?: "asc" | "desc" | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						items: {
							path: string;
							name: string;
							kind: "file" | "folder";
							nodeId: import("convex/values").GenericId<"files_nodes">;
							contentType: string | null;
							updatedAt: number;
							status: "ready" | "pending" | null;
							size: number | null;
							locked: boolean;
							readOnly: boolean | null;
						}[];
						cursor: string | null;
						isDone: boolean;
						message?: undefined;
						errorCode?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: string;
						errorCode: "invalid_cursor";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "not_found";
					} | {
						message: "File unavailable";
						errorCode: "not_found";
						items?: undefined;
						cursor?: undefined;
						isDone?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/read": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				path: string;
				cursor?: string | null | undefined;
			};
			response: {
				200: {
					headers: {
						"X-File-Next-Cursor"?: string | undefined;
						"Content-Type": "application/octet-stream";
						"X-File-Content-Type": string;
						"X-File-Revision": string;
						"X-File-Is-Latest": string;
						"X-File-Size": string;
						"Cache-Control": string;
					};
					body: Uint8Array<ArrayBuffer>;
				};
				400: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: string;
						errorCode: "invalid_cursor";
					};
				};
				403: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: string;
						errorCode: "file_changed";
					};
				};
				401: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				429: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "read_budget_exhausted";
					};
				};
				503: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: string;
						errorCode: "storage_unavailable";
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/write": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				path: string;
				content: string;
				force?: boolean | undefined;
				expectedParentNodeId?: string | undefined;
				overwrite?: "replace" | "fail" | undefined;
				skipIfUnchanged?: boolean | undefined;
				expectedRevision?: string | undefined;
				nonCollaborative?: boolean | undefined;
				contentType?: string | undefined;
				access?: {
					readOnly?: boolean | undefined;
				} | undefined;
				writer?: {
					writerId: string;
					operationId: string;
					writerGeneration: number;
					sequence: number;
					expectedNodeId: string | null;
					expectedContentRevision: string | null;
					contentHash: string;
				} | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						contentType: | `text/${"markdown" | "plain" | "html"}${"" | `;charset=${"utf-8"}`}`
	| "application/json"
	| "application/yaml"
	| "application/toml"
	| "text/csv"
	| "text/tab-separated-values"
	| "text/css"
	| "text/javascript"
	| "text/typescript"
	| "application/x-sh"
	| "application/sql"
	| "application/octet-stream";
						receipt: {
							_id: import("convex/values").GenericId<"plugins_external_file_receipts">;
							_creationTime: number;
							organizationId: import("convex/values").GenericId<"organizations">;
							workspaceId: import("convex/values").GenericId<"organizations_workspaces">;
							createdAt: number;
							path: string;
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							writerGeneration: number;
							operationId: string;
							sequence: number;
							contentRevision: string | null;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
							operation: "fence" | "archive" | "read_only" | "write";
							fingerprint: string;
						};
						message?: undefined;
						errorCode?: undefined;
						revision?: undefined;
						size?: undefined;
						contentChanged?: undefined;
						normalizations?: undefined;
						usedEditorText?: undefined;
						unchanged?: undefined;
					} | {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						contentType: | `text/${"markdown" | "plain" | "html"}${"" | `;charset=${"utf-8"}`}`
	| "application/json"
	| "application/yaml"
	| "application/toml"
	| "text/csv"
	| "text/tab-separated-values"
	| "text/css"
	| "text/javascript"
	| "text/typescript"
	| "application/x-sh"
	| "application/sql"
	| "application/octet-stream";
						revision: string;
						size: number;
						contentChanged: boolean;
						normalizations: ("line_endings" | "bom_removed")[];
						usedEditorText: false;
						unchanged: true;
						message?: undefined;
						errorCode?: undefined;
						receipt?: undefined;
					} | {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						contentType: | `text/${"markdown" | "plain" | "html"}${"" | `;charset=${"utf-8"}`}`
	| "application/json"
	| "application/yaml"
	| "application/toml"
	| "text/csv"
	| "text/tab-separated-values"
	| "text/css"
	| "text/javascript"
	| "text/typescript"
	| "application/x-sh"
	| "application/sql"
	| "application/octet-stream";
						revision: string;
						size: number;
						contentChanged: boolean;
						normalizations: ("line_endings" | "bom_removed")[];
						usedEditorText: false;
						message?: undefined;
						errorCode?: undefined;
						receipt?: undefined;
						unchanged?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input" | "too_many_folders" | "file_reference_limit";
					} | {
						message: "Invalid file operation ID";
						errorCode: "invalid_input";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						revision?: undefined;
						size?: undefined;
						contentChanged?: undefined;
						normalizations?: undefined;
						usedEditorText?: undefined;
						unchanged?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied" | "file_reference_denied";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "read_only" | "conflict" | "stale_write" | "file_changed" | "file_needs_repair" | "file_not_latest" | "file_exists" | "text_not_found" | "text_not_unique" | "file_busy";
					} | {
						message: "The output folder or writer changed" | "This operation was already used for another write" | "A newer file write already exists" | "The file changed during the write";
						errorCode: "stale_write";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						revision?: undefined;
						size?: undefined;
						contentChanged?: undefined;
						normalizations?: undefined;
						usedEditorText?: undefined;
						unchanged?: undefined;
					} | {
						message: "This item is read-only.";
						errorCode: "read_only";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						revision?: undefined;
						size?: undefined;
						contentChanged?: undefined;
						normalizations?: undefined;
						usedEditorText?: undefined;
						unchanged?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				402: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "insufficient_funds";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					} | {
						message: "The write receipt is unavailable";
						errorCode: "internal_error";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						revision?: undefined;
						size?: undefined;
						contentChanged?: undefined;
						normalizations?: undefined;
						usedEditorText?: undefined;
						unchanged?: undefined;
					};
				};
			};
		};
	};
	"/api/v1/files/touch": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				paths: string[];
				force?: boolean | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						files: {
							path: string;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							created: boolean;
						}[];
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					} | {
						message: string;
						errorCode: "too_many_folders";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "read_only";
					} | {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					};
				};
			};
		};
	};
	"/api/v1/files/download-urls": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				fileNodeIds: string[];
				expiresInSeconds?: number | undefined;
				download?: boolean | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						items: {
							name: string;
							contentType: string | null;
							fileNodeId: string;
							url: string;
							expiresAt: number;
						}[];
						errors: ({
							fileNodeId: string;
							message: "Permission denied";
							errorCode: "permission_denied";
						} | {
							fileNodeId: string;
							message: "Not found";
							errorCode: "not_found";
						})[];
						truncated: boolean;
						message?: undefined;
						errorCode?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						items?: undefined;
						errors?: undefined;
						truncated?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
						items?: undefined;
						errors?: undefined;
						truncated?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/plugin-folders/ensure": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				path: string;
				force?: boolean | undefined;
				access?: {
					readOnly?: boolean | undefined;
				} | undefined;
				writer?: {
					resourceKey: string;
					rootNodeId: string | null;
				} | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						nodeId: import("convex/values").GenericId<"files_nodes">;
						path: string;
						created: boolean;
						writer: {
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							rootNodeId: import("convex/values").GenericId<"files_nodes">;
							folderNodeId: import("convex/values").GenericId<"files_nodes">;
							writerGeneration: number;
						} | {
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							rootNodeId: import("convex/values").GenericId<"files_nodes">;
							folderNodeId: import("convex/values").GenericId<"files_nodes">;
							writerGeneration: 1;
						};
					} | {
						nodeId: import("convex/values").GenericId<"files_nodes">;
						path: string;
						created: boolean;
						writer?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "permission_denied";
					} | {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "stale_write";
					} | {
						message: string;
						errorCode: "read_only";
					} | {
						message: string;
						errorCode: "move_busy";
					} | {
						message: string;
						errorCode: "path_busy";
					} | {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: string;
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/plugin-archive": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				path: string;
				force?: boolean | undefined;
				requestId?: string | undefined;
				previousRequestId?: string | undefined;
				writer?: {
					writerId: string;
					operationId: string;
					writerGeneration: number;
					sequence: number;
					nodeId: string;
					expectedContentRevision?: string | undefined;
				} | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						requestId: string;
						archivedNodes: number;
						complete: boolean;
						refused: ({
							path: string | null;
							message: string;
							errorCode: "permission_denied";
						} | {
							path: string | null;
							message: string;
							errorCode: "read_only";
						} | {
							path: string | null;
							message: string;
							errorCode: "move_busy";
						} | {
							path: string | null;
							message: string;
							errorCode: "conflict";
						})[];
					} | {
						archivedNodes: 1;
						receipt: {
							_id: import("convex/values").GenericId<"plugins_external_file_receipts">;
							_creationTime: number;
							organizationId: import("convex/values").GenericId<"organizations">;
							workspaceId: import("convex/values").GenericId<"organizations_workspaces">;
							createdAt: number;
							path: string;
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							writerGeneration: number;
							operationId: string;
							sequence: number;
							contentRevision: string | null;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
							operation: "fence" | "archive" | "read_only" | "write";
							fingerprint: string;
						};
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "stale_write";
					} | {
						message: string;
						errorCode: "read_only";
					} | {
						message: string;
						errorCode: "move_busy";
					} | {
						message: string;
						errorCode: "path_busy";
					} | {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/plugin-access/set": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				path: string;
				access: {
					readOnly: boolean;
				};
				writer?: {
					writerId: string;
					operationId: string;
					writerGeneration: number;
				} | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						nodeId: import("convex/values").GenericId<"files_nodes">;
						receipt: {
							_id: import("convex/values").GenericId<"plugins_external_file_receipts">;
							_creationTime: number;
							organizationId: import("convex/values").GenericId<"organizations">;
							workspaceId: import("convex/values").GenericId<"organizations_workspaces">;
							createdAt: number;
							path: string;
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							writerGeneration: number;
							operationId: string;
							sequence: number;
							contentRevision: string | null;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
							operation: "fence" | "archive" | "read_only" | "write";
							fingerprint: string;
						};
					} | {
						nodeId: import("convex/values").GenericId<"files_nodes">;
						receipt?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "stale_write";
					} | {
						message: string;
						errorCode: "read_only";
					} | {
						message: string;
						errorCode: "move_busy";
					} | {
						message: string;
						errorCode: "path_busy";
					} | {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/plugin-writers/inspect": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				writerId: string;
				path: string;
				maxBytes: number;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						nodeId: import("convex/values").GenericId<"files_nodes"> | null;
						content: string | null;
						contentType: string | null;
						contentRevision: string | null;
						expectedParentNodeId: import("convex/values").GenericId<"files_nodes">;
						writerGeneration: number;
						message?: undefined;
						errorCode?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "stale_write";
					} | {
						message: string;
						errorCode: "read_only";
					} | {
						message: string;
						errorCode: "move_busy";
					} | {
						message: string;
						errorCode: "path_busy";
					} | {
						message: "The target is not an editable text file.";
						errorCode: "conflict";
						nodeId?: undefined;
						content?: undefined;
						contentType?: undefined;
						contentRevision?: undefined;
						expectedParentNodeId?: undefined;
						writerGeneration?: undefined;
					} | {
						message: "The file changed during the read.";
						errorCode: "file_changed";
						nodeId?: undefined;
						content?: undefined;
						contentType?: undefined;
						contentRevision?: undefined;
						expectedParentNodeId?: undefined;
						writerGeneration?: undefined;
					} | {
						message: "File content exceeds the requested read limit.";
						errorCode: "content_too_large";
						nodeId?: undefined;
						content?: undefined;
						contentType?: undefined;
						contentRevision?: undefined;
						expectedParentNodeId?: undefined;
						writerGeneration?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/files/plugin-writers/advance": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				writerId: string;
				operationId: string;
				writerGeneration: number;
				nextGeneration: number;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						_id: import("convex/values").GenericId<"plugins_external_file_receipts">;
						_creationTime: number;
						organizationId: import("convex/values").GenericId<"organizations">;
						workspaceId: import("convex/values").GenericId<"organizations_workspaces">;
						createdAt: number;
						path: string;
						writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
						writerGeneration: number;
						operationId: string;
						sequence: number;
						contentRevision: string | null;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
						operation: "fence" | "archive" | "read_only" | "write";
						fingerprint: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					} | {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "stale_write";
					} | {
						message: string;
						errorCode: "read_only";
					} | {
						message: string;
						errorCode: "move_busy";
					} | {
						message: string;
						errorCode: "path_busy";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/volumes/list": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				mountId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						mounts: {
							mountId: string;
							name: string;
							volumes: {
								volumeKey: string;
								deleting: boolean;
								published: {
									revision: string;
									fileCount: number;
									bytes: number;
									publishedAt: number;
								} | null;
								staging: {
									stagingId: import("convex/values").GenericId<"plugins_volume_generations">;
									revision: string;
									fileCount: number;
									bytes: number;
									expiresAt: number;
								} | null;
							}[];
						}[];
						usage: {
							fileCount: number;
							bytes: number;
							dailyFilesLeft: number;
							limits: {
								fileBytes: 900000;
								copyFiles: 5000;
								copyBytes: 30000000;
								installationFiles: 20000;
								installationBytes: 200000000;
								dailyFiles: 10000;
								volumesPerMount: 32;
								volumesPerInstallation: 128;
							};
						};
					};
				};
				400: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						"Cache-Control": string;
					} | {
						"Cache-Control": "no-store";
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						"Cache-Control": string;
					} | {
						"Cache-Control": "no-store";
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				413: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						"Cache-Control": string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					};
				};
			};
		};
	};
	"/api/v1/volumes/stage": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				mountId: string;
				volumeKey: string;
				revision: string;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						stagingId: import("convex/values").GenericId<"plugins_volume_generations">;
						abandonedStagingId: import("convex/values").GenericId<"plugins_volume_generations"> | null;
					};
				};
				400: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "volume_deleting";
					} | {
						message: string;
						errorCode: "volume_cap_reached";
					};
				};
				401: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				413: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						"Cache-Control": string;
					} | {
						"Cache-Control": "no-store";
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					};
				};
			};
		};
	};
	"/api/v1/volumes/write-many": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				stagingId: string;
				files: {
					path: string;
					content: string;
				}[];
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						written: {
							bytes: number;
							path: string;
						}[];
						errors: {
							path: string;
							errorCode: string;
							message: string;
						}[];
					};
				};
				400: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "volume_deleting";
					} | {
						message: string;
						errorCode: "daily_cap_reached";
					} | {
						message: string;
						errorCode: "staging_unavailable";
					};
				};
				401: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				402: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "insufficient_funds";
					};
				};
				413: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					};
				};
			};
		};
	};
	"/api/v1/volumes/publish": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				stagingId: string;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						volumeKey: string;
						revision: string;
						fileCount: number;
						bytes: number;
						publishedAt: number;
					};
				};
				400: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "volume_deleting";
					} | {
						message: string;
						errorCode: "staging_unavailable";
					} | {
						message: string;
						errorCode: "empty_copy";
					};
				};
				401: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					};
				};
			};
		};
	};
	"/api/v1/volumes/delete": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				mountId: string;
				volumeKey: string;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						deleted: true;
					};
				};
				400: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "volume_deleting";
					};
				};
				401: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "not_found";
					};
				};
				413: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						message: string;
						errorCode: "request_too_large";
					};
				};
				429: {
					headers: {
						"Cache-Control": "no-store";
					} | {
						"Cache-Control": string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: string;
						errorCode: "storage_failure";
					};
				};
			};
		};
	};
	"/api/v1/plugin-runs/follow-up": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				state: string;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						ok: true;
						message?: undefined;
						errorCode?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						ok?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Unauthorized" | "Permission denied" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed" | "File access changed. Start a new plugin run." | "Plugin run chain limit exceeded" | "A follow-up is already requested" | "Follow-up state must be at most 16 KiB" | "Follow-up state must be valid JSON";
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "Permission denied" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed" | "File access changed. Start a new plugin run." | "Plugin run chain limit exceeded" | "A follow-up is already requested" | "Follow-up state must be at most 16 KiB" | "Follow-up state must be valid JSON";
						errorCode: "follow_up_already_requested";
					} | {
						message: "Unauthenticated" | "Unauthorized" | "Permission denied" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed" | "File access changed. Start a new plugin run." | "Plugin run chain limit exceeded" | "A follow-up is already requested" | "Follow-up state must be at most 16 KiB" | "Follow-up state must be valid JSON";
						errorCode: "chain_limit";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Unauthorized" | "Permission denied" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed" | "File access changed. Start a new plugin run." | "Plugin run chain limit exceeded" | "A follow-up is already requested" | "Follow-up state must be at most 16 KiB" | "Follow-up state must be valid JSON";
						errorCode: "unauthenticated";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/identity/exchange": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				exchangeId: string;
				requestedExpiresAt: number;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						jwt: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Lease has expired";
						errorCode: "expired_lease";
						retryAfterMs?: undefined;
					} | {
						message: "Installation is unavailable";
						errorCode: "unavailable";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Snapshot required";
						errorCode: "snapshot_required";
						retryAfterMs?: undefined;
					} | {
						message: "Installation has been removed";
						errorCode: "revoked";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/members/list": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				installationId: string;
				cursor: string | null;
				startRevision: number | null;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						startRevision: number;
						currentRevision: number;
						members: {
							hostUserId: string;
							hostMembershipId: string;
							membershipLifetime: number;
							displayName: string | null;
							active: boolean;
							canRead: boolean;
							canWrite: boolean;
							isOwner: boolean;
						}[];
						continueCursor: string | null;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Lease has expired";
						errorCode: "expired_lease";
						retryAfterMs?: undefined;
					} | {
						message: "Installation is unavailable";
						errorCode: "unavailable";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Snapshot required";
						errorCode: "snapshot_required";
						retryAfterMs?: undefined;
					} | {
						message: "Installation has been removed";
						errorCode: "revoked";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/access/changes": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				installationId: string;
				afterRevision: number;
				limit: number;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						events: {
							revision: number;
							event: {
								kind: "refresh";
								reason: "installation" | "permissions" | "account";
							} | {
								kind: "member";
								member: {
									membershipLifetime: number;
									active: boolean;
									displayName: string | null;
									hostUserId: string;
									hostMembershipId: string | null;
									canRead: boolean;
									canWrite: boolean;
									isOwner: boolean;
								};
							} | {
								kind: "session_revoked";
								hostSessionId: string;
							} | {
								kind: "revoked";
								reason: "uninstalled" | "workspace_deleted" | "organization_deleted";
							} | {
								kind: "noop";
							};
						}[];
						currentRevision: number;
						continueRevision: number;
						isDone: boolean;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Lease has expired";
						errorCode: "expired_lease";
						retryAfterMs?: undefined;
					} | {
						message: "Installation is unavailable";
						errorCode: "unavailable";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Snapshot required";
						errorCode: "snapshot_required";
						retryAfterMs?: undefined;
					} | {
						message: "Installation has been removed";
						errorCode: "revoked";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/service-events/key": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				pluginName: string;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						key: string;
						createdAt: number;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Lease has expired";
						errorCode: "expired_lease";
						retryAfterMs?: undefined;
					} | {
						message: "Installation is unavailable";
						errorCode: "unavailable";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Snapshot required";
						errorCode: "snapshot_required";
						retryAfterMs?: undefined;
					} | {
						message: "Installation has been removed";
						errorCode: "revoked";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/service-grants/exchange": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				requestId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						token: string;
						expiresAt: number;
						scopes: ("files:write" | "plugin_data:read" | "plugin_data:write")[];
						principalKey: string;
						actorUserId: string;
						organizationId: string;
						workspaceId: string;
						installationId: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: "Failed to mint a unique grant token";
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/service-grants/recover": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				operation: "seal" | "exchange" | "renew";
				requestId: string;
				destinationPathPrefix?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						token: string;
						grantId: import("convex/values").GenericId<"plugin_service_grants">;
						principalKey: string;
						scopes: ("files:write" | "plugin_data:read" | "plugin_data:write")[];
						expiresAt: number;
						actorUserId: import("convex/values").GenericId<"users">;
						organizationId: import("convex/values").GenericId<"organizations">;
						workspaceId: import("convex/values").GenericId<"organizations_workspaces">;
						installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
						destinationPathPrefix: string | null;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthorized";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					} | {
						message: "No saved grant response";
						errorCode: "not_found";
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: "Failed to mint a unique grant token";
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/service-grants/renew": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				requestId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						token: string;
						expiresAt: number;
						scopes: ("files:write" | "plugin_data:read" | "plugin_data:write")[];
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: "Failed to mint a unique grant token";
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/service-grants/seal-processing": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				destinationPathPrefix: string;
				requestId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						token: string;
						expiresAt: number;
						scopes: ("files:write" | "plugin_data:read" | "plugin_data:write")[];
						principalKey: string;
						destinationPathPrefix: string;
						actorUserId: string;
						organizationId: string;
						workspaceId: string;
						installationId: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
						errorCode: "permission_denied";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
					} | {
						message: "Unauthenticated";
						errorCode: "unauthenticated";
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
						errorCode: "not_found";
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: "Failed to mint a unique grant token";
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugins/service-grants/verify-live": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				Authorization: string;
				"X-Bonobo-Service-Authorization": string;
			};
			body: {
				installationId: string;
				phase: "interactive" | "processing";
				destinationPathPrefix: string | null;
				scopes: ("files:write" | "plugin_data:read" | "plugin_data:write")[];
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						installationId: string;
						phase: "interactive" | "processing";
						scopes: ("files:write" | "plugin_data:read" | "plugin_data:write")[];
						destinationPathPrefix: string | null;
						expiresAt: number;
						contentPermissions: {
							read: boolean;
							write: boolean;
						};
						message?: undefined;
						errorCode?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "This grant is for another installation";
						errorCode: "conflict";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant is in another phase";
						errorCode: "conflict";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant writes to another destination";
						errorCode: "conflict";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant no longer has the scopes it needs";
						errorCode: "conflict";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant's member can no longer use the scopes it needs";
						errorCode: "conflict";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						errorCode: "unauthenticated";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/activities/start": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				title: string;
				timeoutMs: number;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						activityId: import("convex/values").GenericId<"activities">;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "permission_denied";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "conflict";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					} | {
						message: string;
						errorCode: "unauthenticated";
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					};
				};
			};
		};
	};
	"/api/v1/plugin-backend/invoke": {
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				endpoint: string;
				input?: unknown;
				serializationKey?: string | undefined;
			};
			response: {
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "internal_error";
					} | {
						message: "Plugin backend failed";
						errorCode: "internal_error";
						runId: string;
						retryAfterMs?: undefined;
					} | {
						message: "Plugin backend response was too large";
						errorCode: "response_too_large";
						runId: string;
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
						errorCode: "invalid_input";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Scheduled plugin runs cannot use Trash yet.";
						errorCode: "permission_denied";
						retryAfterMs?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Another invoke is already running for this endpoint";
						errorCode: "invoke_busy";
						retryAfterMs: number;
						runId?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Unauthorized" | "The scheduled user must grant access again" | "The scheduled user is not an active workspace member" | "Choose a scheduled user with their own permission grant" | "This schedule is not available" | "The scheduled assignment changed";
						errorCode: "unauthenticated";
						retryAfterMs?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found" | "Endpoint not found";
						errorCode: "not_found";
						retryAfterMs?: undefined;
						runId?: undefined;
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						errorCode: "request_too_large";
					} | {
						message: "Invoke request is too large for this plugin configuration";
						errorCode: "request_too_large";
						retryAfterMs?: undefined;
						runId?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						errorCode: "rate_limited";
						retryAfterMs: number;
					} | {
						message: "Plugin API call limit exceeded";
						errorCode: "call_limit_reached";
						retryAfterMs?: undefined;
					};
				};
				200: {
					headers: {
						"Cache-Control": "no-store";
						"Content-Type": "application/json";
					};
					body: {
						runId: string;
						pluginStatus: number;
						output: string;
					};
				};
			};
		};
	};
	"/plugins-ui/session-jwt": {
		OPTIONS: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: null;
			response: {
				204: {
					headers: {
						[x: string]: string;
					};
					body: null;
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: null;
				};
			};
		};
		POST: {
			pathParams: never;
			searchParams: never;
			headers: {
				[x: string]: string;
			};
			body: {
				token?: string | undefined;
			};
			response: {
				200: {
					headers: {
						[x: string]: string;
					};
					body: {
						_yay: {
							jwt: string;
							sessionExpiresAt: number;
						};
						_nay?: undefined | undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						_nay: {
							name: undefined;
							message: "Request body must carry a token";
							cause: never;
							data: never;
							stack?: string | undefined;
						};
						_yay?: undefined | undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						_nay: {
							name: undefined;
							message: "Unauthorized";
							cause: never;
							data: never;
							stack?: string | undefined;
						};
						_yay?: undefined | undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						_nay: {
							name: undefined;
							message: "Unauthenticated";
							cause: never;
							data: never;
							stack?: string | undefined;
						};
						_yay?: undefined | undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
			};
		};
	};
};

export type BonoboHttpApiPath = keyof BonoboHttpApi;

export type BonoboHttpResponse<P extends BonoboHttpApiPath> = {
	[S in keyof BonoboHttpApi[P]["POST"]["response"]]: {
		status: S;
		body: BonoboHttpApi[P]["POST"]["response"][S]["body"] | null;
	};
}[keyof BonoboHttpApi[P]["POST"]["response"]];
