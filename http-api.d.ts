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
				overwrite?: "replace" | "fail" | undefined;
				skipIfUnchanged?: boolean | undefined;
				nonCollaborative?: boolean | undefined;
				access?: {
					readOnly?: boolean | undefined;
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
						contentType: "text/markdown;charset=utf-8";
						unchanged: true;
					} | {
						path: string;
						nodeId: import("convex/values").GenericId<"files_nodes">;
						contentType: "text/markdown;charset=utf-8";
						unchanged?: undefined;
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
						message: "Unauthenticated" | "Plugin API call limit exceeded";
						retryAfterMs?: undefined;
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
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						items: {
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
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						archivedNodes: number;
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
				};
			};
			response: {
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						nodeId: import("convex/values").GenericId<"files_nodes">;
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
						message: string;
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
				200: {
					headers: {
						"Cache-Control": "no-store";
					};
					body: {
						runId: string;
						pluginStatus: number;
						output: string;
						outputTruncated: boolean;
						message?: undefined;
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
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
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
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
					} | {
						message: "Request body is too large" | "Request body validation failed" | "Failed to parse request body as JSON";
						retryAfterMs?: undefined;
						runId?: undefined;
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
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
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
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
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
					};
				};
				502: {
					headers: {
						[x: string]: string;
					};
					body: {
						message: "Plugin backend failed";
						runId: string;
						retryAfterMs?: undefined;
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
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
						pluginStatus?: undefined;
						output?: undefined;
						outputTruncated?: undefined;
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
