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
							createdAt: number;
							value: {
								[x: string]: any;
							};
							collection: string;
							key: string;
							byteSize: number;
							revision: number;
							writeMode: "normal" | "versioned";
							ownership: "shared" | "owned";
						}[];
						cursor: string | null;
						isDone: boolean;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
					};
				};
			};
		};
	};
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
							createdAt: number;
							value: {
								[x: string]: any;
							};
							collection: string;
							key: string;
							byteSize: number;
							revision: number;
							writeMode: "normal" | "versioned";
							ownership: "shared" | "owned";
						} | null;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
							status: "pending" | "ready" | null;
							size: number | null;
						}[];
						cursor: string;
						isDone: boolean;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
				maxBytes?: number | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						content: string;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
				expectedParentNodeId?: string | undefined;
				overwrite?: "replace" | "fail" | undefined;
				skipIfUnchanged?: boolean | undefined;
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
					expectedReaderRevision: number | null;
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
						contentType: | `text/${"markdown" | "plain"}${"" | `;charset=${"utf-8"}`}`
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
							path: string;
							createdAt: number;
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							writerGeneration: number;
							operationId: string;
							sequence: number;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
							operation: "write" | "fence" | "readers" | "archive" | "rollback_readers" | "cancel_readers";
							fingerprint: string;
							contentRevision: string | null;
							readerRevision: number | null;
						};
						message?: undefined;
						unchanged?: undefined;
					} | {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						contentType: | `text/${"markdown" | "plain"}${"" | `;charset=${"utf-8"}`}`
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
						unchanged: true;
						message?: undefined;
						receipt?: undefined;
					} | {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						contentType: | `text/${"markdown" | "plain"}${"" | `;charset=${"utf-8"}`}`
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
						message?: undefined;
						receipt?: undefined;
						unchanged?: undefined;
					};
				};
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "The write receipt is unavailable";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						unchanged?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied" | "This item is read-only." | "The file readers changed" | "The output folder or writer changed" | "This operation was already used for another write" | "A newer file write already exists" | "The file changed during the write";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						unchanged?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied" | "This item is read-only." | "The file readers changed" | "The output folder or writer changed" | "This operation was already used for another write" | "A newer file write already exists" | "The file changed during the write";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
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
					} | {
						message: "Invalid file operation ID";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						unchanged?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied" | "This item is read-only." | "The file readers changed" | "The output folder or writer changed" | "This operation was already used for another write" | "A newer file write already exists" | "The file changed during the write";
						path?: undefined;
						nodeId?: undefined;
						contentType?: undefined;
						receipt?: undefined;
						unchanged?: undefined;
					};
				};
				402: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
						errors: {
							fileNodeId: string;
							message: string;
						}[];
						truncated: boolean;
						message?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body is too large";
						items?: undefined;
						errors?: undefined;
						truncated?: undefined;
					} | {
						message: "Failed to parse request body as JSON";
						items?: undefined;
						errors?: undefined;
						truncated?: undefined;
					} | {
						message: "Request body validation failed";
						items?: undefined;
						errors?: undefined;
						truncated?: undefined;
					} | {
						message: "fileNodeIds must be unique";
						items?: undefined;
						errors?: undefined;
						truncated?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
				access?: {
					readOnly?: boolean | undefined;
					readScopeId?: string | null | undefined;
					readers?: {
						userId: string;
						membershipLifetime: number;
					}[] | undefined;
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
							readerRevision: number | null;
							detached: boolean;
						} | {
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							rootNodeId: import("convex/values").GenericId<"files_nodes">;
							folderNodeId: import("convex/values").GenericId<"files_nodes">;
							writerGeneration: 1;
							readerRevision: 1 | null;
							detached: false;
						};
					} | {
						nodeId: import("convex/values").GenericId<"files_nodes">;
						path: string;
						created: boolean;
						writer?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: string;
					} | {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
						archivedNodes: 1;
						receipt: {
							_id: import("convex/values").GenericId<"plugins_external_file_receipts">;
							_creationTime: number;
							organizationId: import("convex/values").GenericId<"organizations">;
							workspaceId: import("convex/values").GenericId<"organizations_workspaces">;
							path: string;
							createdAt: number;
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							writerGeneration: number;
							operationId: string;
							sequence: number;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
							operation: "write" | "fence" | "readers" | "archive" | "rollback_readers" | "cancel_readers";
							fingerprint: string;
							contentRevision: string | null;
							readerRevision: number | null;
						};
					} | {
						archivedNodes: number;
						receipt?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: "Permission denied";
					} | {
						message: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
					readOnly?: boolean | undefined;
					readScopeId?: string | null | undefined;
					readers?: {
						userId: string;
						membershipLifetime: number;
					}[] | undefined;
				};
				writer?: {
					writerId: string;
					operationId: string;
					writerGeneration: number;
					expectedReaderRevision: number;
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
							path: string;
							createdAt: number;
							writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
							writerGeneration: number;
							operationId: string;
							sequence: number;
							nodeId: import("convex/values").GenericId<"files_nodes">;
							installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
							operation: "write" | "fence" | "readers" | "archive" | "rollback_readers" | "cancel_readers";
							fingerprint: string;
							contentRevision: string | null;
							readerRevision: number | null;
						};
					} | {
						nodeId: import("convex/values").GenericId<"files_nodes">;
						receipt?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: string;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: "Permission denied";
					} | {
						message: string;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
			};
		};
	};
	"/api/v1/files/plugin-access/undo": {
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
				receiptId?: string | undefined;
				originalReaderOperationId?: string | undefined;
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						_id: import("convex/values").GenericId<"plugins_external_file_receipts">;
						readerRevision: number;
						detached: false;
						restored: true;
					} | {
						_id: null;
						readerRevision: number;
						detached: true;
						restored: false;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						code?: string | undefined;
						message: "Unauthenticated";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "This item is read-only." | "Choose one reader operation" | "Use a separate rollback operation" | "This operation was already used" | "The output folder changed" | "A newer file access change exists";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body validation failed" | "Failed to parse request body as JSON";
					} | {
						message: "Invalid file operation ID";
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "This item is read-only." | "Choose one reader operation" | "Use a separate rollback operation" | "This operation was already used" | "The output folder changed" | "A newer file access change exists";
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
						readerRevision: number | null;
						detached: boolean;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
						path: string;
						createdAt: number;
						writerId: import("convex/values").GenericId<"plugins_external_file_writers">;
						writerGeneration: number;
						operationId: string;
						sequence: number;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						installationId: import("convex/values").GenericId<"plugins_workspace_installations">;
						operation: "write" | "fence" | "readers" | "archive" | "rollback_readers" | "cancel_readers";
						fingerprint: string;
						contentRevision: string | null;
						readerRevision: number | null;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "rate_limited";
						message: "Rate limit exceeded";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "unauthorized";
						message: "Unauthorized";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "permission_denied";
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "invalid_request";
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "expired_lease";
						message: "Lease has expired";
					} | {
						code: "unavailable";
						message: "Installation is unavailable";
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "snapshot_required";
						message: "Snapshot required";
					} | {
						code: "revoked";
						message: "Installation has been removed";
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "rate_limited";
						message: "Rate limit exceeded";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "unauthorized";
						message: "Unauthorized";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "permission_denied";
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "invalid_request";
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "expired_lease";
						message: "Lease has expired";
					} | {
						code: "unavailable";
						message: "Installation is unavailable";
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "snapshot_required";
						message: "Snapshot required";
					} | {
						code: "revoked";
						message: "Installation has been removed";
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
								reason: "installation" | "permissions" | "account" | "members";
							} | {
								kind: "member";
								member: {
									active: boolean;
									displayName: string | null;
									membershipLifetime: number;
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "rate_limited";
						message: "Rate limit exceeded";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "unauthorized";
						message: "Unauthorized";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "permission_denied";
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "invalid_request";
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "expired_lease";
						message: "Lease has expired";
					} | {
						code: "unavailable";
						message: "Installation is unavailable";
					};
				};
				410: {
					headers: {
						[x: string]: string;
					};
					body: {
						code: "snapshot_required";
						message: "Snapshot required";
					} | {
						code: "revoked";
						message: "Installation has been removed";
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
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Failed to mint a unique grant token";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
					} | {
						message: "Unauthenticated";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
				operation: "exchange" | "renew" | "seal";
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
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Failed to mint a unique grant token";
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
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated";
					} | {
						message: "Unauthorized";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
					} | {
						message: "No saved grant response";
						retryAfterMs?: undefined;
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
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Failed to mint a unique grant token";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
					} | {
						message: "Unauthenticated";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
				500: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Failed to mint a unique grant token";
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
					} | {
						message: "Unauthenticated";
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied";
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Not found";
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
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthorized";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Request body validation failed" | "Failed to parse request body as JSON";
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
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant is in another phase";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant writes to another destination";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant no longer has the scopes it needs";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
					} | {
						message: "This grant's member can no longer use the scopes it needs";
						installationId?: undefined;
						phase?: undefined;
						scopes?: undefined;
						destinationPathPrefix?: undefined;
						expiresAt?: undefined;
						contentPermissions?: undefined;
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: string;
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
						message: "Plugin backend failed" | "Plugin backend response was too large";
						runId: string;
						code: "response_too_large" | undefined;
						retryAfterMs?: undefined;
					};
				};
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						retryAfterMs: number;
					} | {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					};
				};
				401: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
					} | {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					};
				};
				403: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Unauthenticated" | "Permission denied";
						retryAfterMs?: undefined;
					} | {
						message: "Permission denied" | "Not found" | "Endpoint not found" | "This endpoint requires a serialization key" | "Serialization keys must be visible ASCII (no spaces) up to 128 characters";
						retryAfterMs?: undefined;
						runId?: undefined;
						code?: undefined;
					};
				};
				400: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Not found" | "Endpoint not found" | "This endpoint requires a serialization key" | "Serialization keys must be visible ASCII (no spaces) up to 128 characters";
						retryAfterMs?: undefined;
						runId?: undefined;
						code?: undefined;
					} | {
						message: "Request body is too large" | "Request body validation failed" | "Failed to parse request body as JSON";
						retryAfterMs?: undefined;
						runId?: undefined;
						code?: undefined;
					};
				};
				409: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Another invoke is already running for this endpoint";
						retryAfterMs: number;
						runId?: undefined;
						code?: undefined;
					};
				};
				404: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Permission denied" | "Not found" | "Endpoint not found" | "This endpoint requires a serialization key" | "Serialization keys must be visible ASCII (no spaces) up to 128 characters";
						retryAfterMs?: undefined;
						runId?: undefined;
						code?: undefined;
					};
				};
				413: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Invoke request is too large for this plugin configuration";
						retryAfterMs?: undefined;
						runId?: undefined;
						code?: undefined;
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
				429: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Rate limit exceeded";
						retryAfterMs: number;
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
