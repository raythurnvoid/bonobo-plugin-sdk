/**
 * Bonobo plugin frontend SDK — hand-written browser ESM, no build step.
 *
 * Runs inside the host app's sandboxed plugin iframe for plugin pages and plugin file views alike.
 * The comments below say "page" for both kinds, the way the host app's own notes do. Any text a
 * MEMBER can end up reading must not: it has to say "plugin frame", because a member sitting in a
 * file view is not on a page and never read these notes. That covers every `new Error(...)` the SDK
 * rejects with, and the `message` it puts in a watch death — plugin code renders those verbatim.
 *
 * The host handshake is a strict postMessage contract: the page announces `bonobo:ready`, the host
 * answers `bonobo:init` with a short-lived scoped session token (`plu_...`), the page context, and
 * the Convex deployment URL. From then on the page acts on its own:
 *
 * - Public `/api/v1/*` calls go straight to the iframe's own origin with
 *   `Authorization: Bearer <token>`.
 * - The `data` and `members` APIs run on the page's OWN Convex client. The client authenticates
 *   with a short-lived plugin-session JWT, minted by exchanging the session token at the
 *   same-origin `/plugins-ui/session-jwt` route. The host window is not part of that data path;
 *   it only answers session-token refreshes over the bridge.
 */

import { ConvexClient } from "convex/browser";
import { anyApi } from "convex/server";

/** `getToken` refreshes when the token is expired or expires within this margin. */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const READY_RETRY_MS = 500;
const REFRESH_DEADLINE_MS = 10_000;
const BRIDGE_NONCE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Client-side copies of the host's plugin-data limits (see the `plugins_data` module in the host
// app). Only version-independent rules are checked here — lengths, a literal ASCII range, an
// integer range. The server also refuses control characters and surrounding whitespace with
// Unicode-property checks; the client must NOT duplicate those, because a browser with newer
// Unicode data would refuse names the server still serves.
const DATA_MAX_NAME_LENGTH = 128;
const DATA_MAX_KEY_PREFIX_LENGTH = 109;
const DATA_MAX_LIST_PAGE_SIZE = 100;
// Printable ASCII only (0x21-0x7E, no space) — a literal code range for the same reason.
const DATA_KEY_PREFIX_REGEX = /^[\x21-\x7e]+$/;

// The host's roster page size. Its own ceiling, not the document one above: the roster is paged
// because each row costs the server two document reads, and that has nothing to do with documents.
const MEMBERS_MAX_LIST_PAGE_SIZE = 100;

// Max page-visible data watches (plain or window alike). One more answers a null death with
// reason "capacity". These caps are courtesy bounds the page enforces on itself: the server
// cannot meter reactive reads per session, so this is what keeps an honest page bounded.
// 16, not 8: `scopes.watchMine` tells a plugin to open one ranged read per private scope, and
// under 8 slots that guidance died at two scopes with a channel open (three windows plus a
// thread watch). Slots and intervals are what shape a page. The server-subscription count
// below is only a backstop for buggy or hostile pages — 16 slots × 6 intervals = 96, which
// stays under 100.
const MAX_WATCH_SUBSCRIPTIONS = 16;

// Key intervals one document window may hold, committed plus pending. Worst case per window:
// 6 intervals × 100 docs × 16 KiB values ≈ 9.6 MiB flattened; a realistic chat channel stays
// around 1 MiB.
const MAX_WINDOW_INTERVALS = 6;

// Server subscriptions across the whole page: one per plain watch, one per window interval,
// committed and pending alike. This is a backstop for a buggy or hostile page, not a budget
// honest plugins design against. Every subscription re-reads the session's auth docs when a
// write invalidates it, so this ceiling bounds that fan-out. Honest pages stay inside the
// 16-slot and 6-interval caps above (96 server subscriptions at worst).
const MAX_PAGE_SERVER_SUBSCRIPTIONS = 100;

/**
 * Reads a host theme off a bridge message.
 *
 * The host resolves its colours and sends the values, because a plugin page is a cross-origin
 * document and inherits none of the host's custom properties. This comes over postMessage, so every
 * field is checked before the page can see it.
 *
 * @param {unknown} value
 * @returns {import("bonobo-plugin-sdk/frontend").BonoboUiTheme | null}
 */
function read_theme(value) {
	if (typeof value !== "object" || value === null) {
		return null;
	}
	const candidate = /** @type {{ mode?: unknown, tokens?: unknown }} */ (value);
	if (candidate.mode !== "light" && candidate.mode !== "dark") {
		return null;
	}
	if (typeof candidate.tokens !== "object" || candidate.tokens === null) {
		return null;
	}
	/** @type {Record<string, string>} */
	const tokens = {};
	for (const [name, tokenValue] of Object.entries(candidate.tokens)) {
		if (typeof tokenValue !== "string") {
			return null;
		}
		tokens[name] = tokenValue;
	}

	return /** @type {import("bonobo-plugin-sdk/frontend").BonoboUiTheme} */ ({ mode: candidate.mode, tokens });
}

/**
 * The deaths the SDK can explain. The server answers the same opaque null for every denial, so
 * these are what the SDK knows on its own: the store said no, the session it holds has run out, or
 * the connection is not working. A page shows a different thing for each — sign in again is useless
 * advice when the plugin was uninstalled.
 */
const DEATH_DENIED = { reason: "denied", message: "This plugin no longer has access to its data" };
const DEATH_SESSION_EXPIRED = { reason: "session_expired", message: "This plugin session expired" };
const DEATH_UNAVAILABLE = { reason: "unavailable", message: "The plugin data connection is unavailable" };

/**
 * Validates the `bonobo:init` context union: `kind: "page"` or `kind: "file_view"`.
 *
 * @param {unknown} value
 */
function is_ui_context(value) {
	if (typeof value !== "object" || value === null) {
		return false;
	}
	const context = /** @type {Record<string, unknown>} */ (value);
	if (
		typeof context.pluginName !== "string" ||
		typeof context.userId !== "string" ||
		typeof context.organizationId !== "string" ||
		typeof context.workspaceId !== "string"
	) {
		return false;
	}
	if (context.kind === "page") {
		return typeof context.pageId === "string" && typeof context.pageTitle === "string";
	}
	if (context.kind === "file_view") {
		if (typeof context.fileViewId !== "string" || typeof context.fileViewTitle !== "string") {
			return false;
		}
		if (typeof context.file !== "object" || context.file === null) {
			return false;
		}
		const file = /** @type {Record<string, unknown>} */ (context.file);
		return (
			typeof file.fileNodeId === "string" &&
			typeof file.name === "string" &&
			typeof file.path === "string" &&
			typeof file.contentType === "string"
		);
	}
	return false;
}

/**
 * Reads the host origin and frame nonce from the URL fragment. The fragment is available to the
 * page but is not sent in the asset request, cache key, or referrer.
 */
function read_bridge_bootstrap() {
	const fragment = window.location.hash.slice(1);
	if (!fragment) {
		throw new Error("Missing host bridge fragment — this plugin frame must be embedded by the Bonobo host app");
	}

	const params = new URLSearchParams(fragment);
	const parentOrigins = params.getAll("parentOrigin");
	const bridgeNonces = params.getAll("bridgeNonce");
	if (params.size !== 2 || parentOrigins.length !== 1 || bridgeNonces.length !== 1) {
		throw new Error("Invalid host bridge fragment");
	}

	const parentOrigin = parentOrigins[0];
	const bridgeNonce = bridgeNonces[0];
	let parsedParentOrigin;
	try {
		parsedParentOrigin = new URL(parentOrigin);
	} catch {
		throw new Error("Invalid host bridge parent origin");
	}
	if (
		(parsedParentOrigin.protocol !== "http:" && parsedParentOrigin.protocol !== "https:") ||
		parsedParentOrigin.origin !== parentOrigin
	) {
		throw new Error("Invalid host bridge parent origin");
	}
	if (!BRIDGE_NONCE_PATTERN.test(bridgeNonce)) {
		throw new Error("Invalid host bridge nonce");
	}

	return { parentOrigin, bridgeNonce };
}

/**
 * Client-side pre-check for watch inputs. Returns a refusal message, or `null` when the inputs
 * pass. Input that passes here can still die on the server with the same bare null a denial gets.
 *
 * @param {{ collection: string, keyPrefix?: string, limit: number }} args
 */
function validate_watch_inputs(args) {
	if (args.collection.length === 0 || args.collection.length > DATA_MAX_NAME_LENGTH) {
		return `Collection names must be 1 to ${DATA_MAX_NAME_LENGTH} characters`;
	}
	if (
		args.keyPrefix !== undefined &&
		(args.keyPrefix.length > DATA_MAX_KEY_PREFIX_LENGTH || !DATA_KEY_PREFIX_REGEX.test(args.keyPrefix))
	) {
		return `Key prefixes must be 1 to ${DATA_MAX_KEY_PREFIX_LENGTH} printable ASCII characters`;
	}
	if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > DATA_MAX_LIST_PAGE_SIZE) {
		return `Watch limits must be integers from 1 to ${DATA_MAX_LIST_PAGE_SIZE}`;
	}
	return null;
}

/**
 * One key interval of a document window: one server subscription over
 * `(gt start .. lte end]`, where a `null` side is unbounded. `docs` is the last delivered array
 * and `previousFirstKey` the first key of the delivery before it — the only legal split
 * fencepost, because the current first key may be a brand-new arrival.
 *
 * @typedef {object} DocumentsWindowInterval
 * @property {string | null} start
 * @property {string | null} end
 * @property {import("bonobo-plugin-sdk").BonoboPublicDoc[] | null} docs
 * @property {boolean} truncated
 * @property {string | undefined} previousFirstKey
 * @property {import("bonobo-plugin-sdk").BonoboPublicDoc[] | null} previousDocs The array this
 *   interval held before its latest delivery. `handle_result` overwrites `docs` in place, so the
 *   outgoing array has to be kept here or it is gone by the time a swap is decided. Read in exactly
 *   one place — `snapshot_suppressed_docs`, when a pending swap starts.
 * @property {() => void} stop Dispose the watcher and release its server slot, exactly once.
 */

/**
 * The page-derived watch args. Interval bounds are excluded from this shape on purpose: they are
 * fenceposts the window manager computes itself and passes as their own parameter, so caller
 * input can never smuggle a bound into a query.
 *
 * @typedef {{ collection: string, keyPrefix?: string, limit: number }} DataWatchQueryArgs
 * @typedef {{ keyStartExclusive?: string, keyEndInclusive?: string } | null} DataWatchBounds
 * @typedef {{ value: { docs: import("bonobo-plugin-sdk").BonoboPublicDoc[], truncated: boolean } | null } | { queryError: unknown }} DataWatchOutcome
 * @typedef {(queryArgs: DataWatchQueryArgs, bounds: DataWatchBounds, onResult: (outcome: DataWatchOutcome) => void) => ({ dispose: () => void } | null)} DataStartWatch
 */

/**
 * A reactive document window: an ordered list of disjoint, contiguous key intervals whose
 * fenceposts are keys the server itself delivered. The page sees one flattened doc list that
 * RETAINS loaded history — arrivals grow an interval and splits absorb the overflow, instead of
 * older docs sliding out of a single capped read.
 *
 * The window manager never compares keys. Fenceposts are picked positionally (an element of a
 * delivered array, or a bound stored at creation), because a JS string comparison disagrees with
 * the index's UTF-8 order on supplementary-plane characters. Everything order-related is the
 * server's job.
 *
 * Swap discipline: the committed interval list is the only flatten source. At most one pending
 * replacement (a split or a merge) exists at a time; the replaced intervals stay committed and
 * keep delivering until every replacement has a result, then the swap commits atomically in the
 * last delivery's callback. Re-seats bypass this: they keep the interval's delivered docs across
 * a dispose-and-create, so they are content-neutral by construction.
 *
 * Kill rule: any interval — committed or pending — answering `null` or erroring kills the whole
 * window: every watcher is disposed synchronously, the page gets exactly one `docs: null`, and
 * later callbacks are ignored. `dead` is checked before every watcher start so an in-flight
 * grow cannot resurrect a killed window.
 *
 * @param {{
 *   queryArgs: DataWatchQueryArgs,
 *   start_watch: DataStartWatch,
 *   acquire_server_slot: () => boolean,
 *   release_server_slot: () => void,
 *   page_at_ceiling: (requiredSlots?: number) => boolean,
 *   post_update: (payload: { docs: import("bonobo-plugin-sdk").BonoboPublicDoc[], hasMore: boolean, atCapacity: boolean, incomplete: boolean }) => void,
 *   on_dead: (info: { reason: string, message: string }) => void,
 *   session_expired: () => boolean,
 * }} deps
 */
function create_documents_window(deps) {
	const state = {
		/** @type {DocumentsWindowInterval[]} */
		intervals: [],
		/**
		 * `suppressedDocs` holds one flatten source per interval the swap suppresses, taken by value
		 * when the swap starts and never updated afterwards. The suppressed intervals stay subscribed
		 * until the commit, so without it a second delivery overwrites their `docs` and the flatten
		 * grows a hole that `incomplete` is suppressed for.
		 *
		 * @type {{ from: number, removeCount: number, replacements: DocumentsWindowInterval[], suppressedDocs: (import("bonobo-plugin-sdk").BonoboPublicDoc[] | null)[] } | null}
		 */
		pending: null,
		queuedLoadOlder: false,
		/** Sticky: set on the first re-seat, when older docs are first known to exist. */
		bottomOpen: false,
		loadingOlder: false,
		/** @type {DocumentsWindowInterval | null} */
		awaitingTail: null,
		/** One-shot: a refused load-older reports atCapacity on the next flush. */
		forceAtCapacity: false,
		flushScheduled: false,
		/** @type {string | null} */
		lastPayloadJson: null,
		dead: false,
	};

	const stop_all = () => {
		state.dead = true;
		for (const interval of state.intervals) {
			interval.stop();
		}
		for (const interval of state.pending?.replacements ?? []) {
			interval.stop();
		}
		state.pending = null;
	};

	/** @param {{ reason: string, message: string }} info */
	const kill = (info) => {
		if (state.dead) {
			return;
		}
		stop_all();
		deps.on_dead(info);
	};

	/** @param {DocumentsWindowInterval} interval */
	const start_interval = (interval) => {
		if (state.dead || !deps.acquire_server_slot()) {
			return false;
		}
		let stopped = false;
		// Results, cached ones included, arrive asynchronously — that is start_watch's delivery
		// contract (the Convex client hands an already-cached result over on a setTimeout(0)).
		// By the time the first result lands, the caller below has finished its bookkeeping:
		// reconcile sees the re-seat of a truncated head, and a cached denial's kill finds this
		// interval registered, so its subscription is disposed instead of leaking.
		const subscription = deps.start_watch(
			deps.queryArgs,
			{
				...(interval.start === null ? {} : { keyStartExclusive: interval.start }),
				...(interval.end === null ? {} : { keyEndInclusive: interval.end }),
			},
			(outcome) => {
				if (!stopped) {
					handle_result(interval, outcome);
				}
			},
		);
		if (!subscription) {
			deps.release_server_slot();
			return false;
		}
		interval.stop = () => {
			if (stopped) {
				return;
			}
			stopped = true;
			subscription.dispose();
			deps.release_server_slot();
		};
		return true;
	};

	/**
	 * Whether a truncated bounded interval can be split. The fencepost is the previously
	 * delivered first key when one exists (so the left side isolates new arrivals); an interval
	 * whose very first delivery already truncated uses its own last delivered key instead, so
	 * the repeat-split that extends coverage does not stall waiting for a second delivery.
	 * Degenerate splits are refused: a fencepost equal to a bound would recreate the parent's
	 * exact args, and Convex dedupes identical-args subscriptions into one token, which would
	 * double-flatten the range.
	 *
	 * @param {DocumentsWindowInterval} interval
	 */
	const split_fencepost = (interval) => {
		if (interval.docs === null || interval.docs.length === 0) {
			return null;
		}
		const fencepost = interval.previousFirstKey ?? interval.docs[interval.docs.length - 1].key;
		if (fencepost === interval.start || fencepost === interval.end) {
			return null;
		}
		if (new Set(interval.docs.map((doc) => doc.key)).size < 2) {
			return null;
		}
		return fencepost;
	};

	const window_interval_count = () => state.intervals.length + (state.pending?.replacements.length ?? 0);

	/**
	 * The count the window will hold once the pending swap commits. `window_interval_count` is the
	 * gross count — it counts the replacements while their parents are still committed — which is
	 * what `reconcile` and the load-older reservation need, because those are asking whether another
	 * subscription fits right now. `incomplete` asks a different question: whether a repair is still
	 * possible after this swap lands, so it needs the net count. A split is +1 and a merge is -1.
	 */
	const settled_interval_count = () =>
		state.intervals.length + (state.pending ? state.pending.replacements.length - state.pending.removeCount : 0);

	/**
	 * The flatten source for an interval a pending swap suppresses, taken once by value when the swap
	 * starts. `interval.truncated` is the discriminator, and the two cases need opposite answers. A
	 * split parent is truncated by construction, so its live array is the short one that would show a
	 * hole — serve the array it held before that delivery. A merge member is never truncated: it
	 * shrank because documents were physically deleted, so its live array is correct and serving the
	 * retained one would put deleted documents back on screen for a round trip.
	 *
	 * The fallback covers an interval whose FIRST delivery truncated, which has no previous array.
	 * Serving `[]` there would make every document in its range vanish for a round trip, which is the
	 * failure this whole mechanism exists to prevent, so it declines to improve that case instead.
	 *
	 * @param {DocumentsWindowInterval} interval
	 */
	const snapshot_suppressed_docs = (interval) =>
		interval.truncated ? (interval.previousDocs ?? interval.docs) : interval.docs;

	/**
	 * @param {number} index
	 * @returns {import("bonobo-plugin-sdk").BonoboPublicDoc[] | null | undefined} The snapshot when a
	 *   pending swap suppresses this index, `undefined` when it does not.
	 */
	const suppressed_docs_at = (index) => {
		if (!state.pending) {
			return undefined;
		}
		const offset = index - state.pending.from;
		if (offset < 0 || offset >= state.pending.removeCount) {
			return undefined;
		}
		return state.pending.suppressedDocs[offset];
	};

	const compute_payload = () => {
		const docs = state.intervals.flatMap((interval, index) => {
			const suppressed = suppressed_docs_at(index);
			return (suppressed === undefined ? interval.docs : suppressed) ?? [];
		});
		const last = state.intervals[state.intervals.length - 1];
		// Full coverage of the remaining range holds only in the terminal state "unbounded tail
		// delivered non-truncated". An undelivered tail still counts as more-to-come.
		const hasMore =
			state.bottomOpen && !(last !== undefined && last.end === null && last.docs !== null && !last.truncated);
		const atCapacity =
			state.forceAtCapacity || state.intervals.length >= MAX_WINDOW_INTERVALS || deps.page_at_ceiling();
		// A truncated bounded interval that no split can repair is a hole in the middle of the
		// flattened list. The page must see that docs are missing instead of a silently shorter
		// history. An interval a pending swap is already replacing is being repaired, not stuck.
		const incomplete = state.intervals.some((interval, index) => {
			if (interval.end === null || !interval.truncated || interval.docs === null) {
				return false;
			}
			if (state.pending && index >= state.pending.from && index < state.pending.from + state.pending.removeCount) {
				return false;
			}
			// Past this point the interval IS a split candidate, so both terms below ask whether
			// `reconcile` could actually run that split. It needs one net interval slot and TWO server
			// slots, because it starts `left` and `right` while the parent is still subscribed.
			return (
				split_fencepost(interval) === null ||
				settled_interval_count() + 1 > MAX_WINDOW_INTERVALS ||
				deps.page_at_ceiling(2)
			);
		});
		return { docs, hasMore, atCapacity, incomplete };
	};

	// One flush per microtask, and a post only when the WHOLE payload changed. Comparing docs
	// alone would swallow the hasMore transition, because a re-seat is content-neutral on purpose.
	const schedule_flush = () => {
		if (state.flushScheduled || state.dead) {
			return;
		}
		state.flushScheduled = true;
		queueMicrotask(() => {
			state.flushScheduled = false;
			if (state.dead) {
				return;
			}
			const payload = compute_payload();
			state.forceAtCapacity = false;
			const payloadJson = JSON.stringify(payload);
			if (payloadJson === state.lastPayloadJson) {
				return;
			}
			state.lastPayloadJson = payloadJson;
			deps.post_update(payload);
		});
	};

	const report_at_capacity = () => {
		if (state.dead) {
			return;
		}
		state.forceAtCapacity = true;
		schedule_flush();
	};

	/**
	 * Re-seat an unbounded interval that just delivered truncated: pin its lower side to its own
	 * largest delivered key and restart the watcher over that closed range. The delivered docs
	 * stay on the interval, so the swap is content-neutral and needs no pending machinery. From
	 * here on, arrivals inside the range grow the interval instead of sliding docs out of a
	 * capped read, and the range below the fencepost belongs to load-older.
	 *
	 * @param {DocumentsWindowInterval} interval
	 */
	const reseat_tail = (interval) => {
		// The caller (reconcile) only re-seats an interval whose docs were delivered.
		const docs = /** @type {import("bonobo-plugin-sdk").BonoboPublicDoc[]} */ (interval.docs);
		const fencepost = docs[docs.length - 1].key;
		interval.stop();
		interval.end = fencepost;
		// The truncation belonged to the old unbounded range. The delivered docs exactly cover the
		// new closed range, so carrying the flag over would read as a hole that is not there.
		interval.truncated = false;
		state.bottomOpen = true;
		// The stop above released a slot, so this 1-for-1 restart cannot hit the ceiling. The only
		// way it still fails is a throwing client, so this is the connection and never the cap —
		// telling the member to close a window would be advice that cannot help.
		if (!start_interval(interval)) {
			kill(DEATH_UNAVAILABLE);
		}
	};

	const execute_load_older = () => {
		if (state.dead || state.loadingOlder || state.pending || !compute_payload().hasMore) {
			return;
		}
		const last = state.intervals[state.intervals.length - 1];
		// hasMore proved the last interval is bounded: an unbounded last either re-seated on its
		// truncated delivery, or is still undelivered behind loadingOlder.
		if (!last || last.end === null) {
			return;
		}
		if (window_interval_count() + 1 > MAX_WINDOW_INTERVALS || deps.page_at_ceiling()) {
			report_at_capacity();
			return;
		}
		// The new tail starts at the STORED bound, not at a delivered key — the last interval's
		// delivered array can be empty after physical deletes, but its bound was a real key once
		// and stays a valid fencepost.
		/** @type {DocumentsWindowInterval} */
		const tail = {
			start: last.end,
			end: null,
			docs: null,
			truncated: false,
			previousFirstKey: undefined,
			previousDocs: null,
			stop: () => {},
		};
		if (!start_interval(tail)) {
			report_at_capacity();
			return;
		}
		state.intervals.push(tail);
		state.loadingOlder = true;
		state.awaitingTail = tail;
	};

	/**
	 * The single re-evaluation point after every delivery and commit: re-seat a truncated
	 * unbounded tail, run a queued load-older, then start at most one pending swap — a split of
	 * the first truncated bounded interval, or a merge of the first adjacent pair small enough
	 * to share one subscription again.
	 */
	const reconcile = () => {
		if (state.dead) {
			return;
		}
		const last = state.intervals[state.intervals.length - 1];
		if (last && last.end === null && last.docs !== null && last.truncated) {
			reseat_tail(last);
			if (state.dead) {
				return;
			}
		}
		if (state.pending) {
			return;
		}
		if (state.queuedLoadOlder) {
			state.queuedLoadOlder = false;
			execute_load_older();
		}

		// Split scan: left = (parent.start .. fencepost], right = (fencepost .. parent.end].
		for (const [index, interval] of state.intervals.entries()) {
			if (interval.end === null || !interval.truncated || interval.docs === null) {
				continue;
			}
			const fencepost = split_fencepost(interval);
			if (fencepost === null) {
				continue;
			}
			// The refused split leaves the interval truncated; the flush reports it as incomplete.
			if (window_interval_count() + 1 > MAX_WINDOW_INTERVALS) {
				break;
			}
			/** @type {DocumentsWindowInterval} */
			const left = {
				start: interval.start,
				end: fencepost,
				docs: null,
				truncated: false,
				previousFirstKey: undefined,
				previousDocs: null,
				stop: () => {},
			};
			/** @type {DocumentsWindowInterval} */
			const right = {
				start: fencepost,
				end: interval.end,
				docs: null,
				truncated: false,
				previousFirstKey: undefined,
				previousDocs: null,
				stop: () => {},
			};
			if (!start_interval(left)) {
				break;
			}
			if (!start_interval(right)) {
				left.stop();
				break;
			}
			state.pending = {
				from: index,
				removeCount: 1,
				replacements: [left, right],
				suppressedDocs: [snapshot_suppressed_docs(interval)],
			};
			return;
		}

		// Merge scan: after physical deletes, two adjacent intervals that together hold less than
		// one page fit back into one subscription, reclaiming a server slot. Exactly one full
		// page is deliberately excluded — that merge would re-split on the very next arrival.
		for (let index = 0; index + 1 < state.intervals.length; index += 1) {
			const first = state.intervals[index];
			const second = state.intervals[index + 1];
			if (first.docs === null || second.docs === null) {
				continue;
			}
			if (first.docs.length + second.docs.length >= deps.queryArgs.limit) {
				continue;
			}
			/** @type {DocumentsWindowInterval} */
			const merged = {
				start: first.start,
				end: second.end,
				docs: null,
				truncated: false,
				previousFirstKey: undefined,
				previousDocs: null,
				stop: () => {},
			};
			if (!start_interval(merged)) {
				break;
			}
			state.pending = {
				from: index,
				removeCount: 2,
				replacements: [merged],
				suppressedDocs: [snapshot_suppressed_docs(first), snapshot_suppressed_docs(second)],
			};
			return;
		}
	};

	// All-or-nothing: the swap commits only once every replacement has a delivered result, so
	// the flattened list never shows a partially re-read range.
	const commit_pending = () => {
		// The caller (handle_result) only commits while a pending swap exists.
		const pending = /** @type {NonNullable<typeof state.pending>} */ (state.pending);
		state.pending = null;
		const replaced = state.intervals.splice(pending.from, pending.removeCount, ...pending.replacements);
		for (const interval of replaced) {
			interval.stop();
		}
		schedule_flush();
		reconcile();
	};

	/**
	 * @param {DocumentsWindowInterval} interval
	 * @param {DataWatchOutcome} outcome
	 */
	const handle_result = (interval, outcome) => {
		if (state.dead) {
			return;
		}
		if ("queryError" in outcome) {
			// This is where an ordinary lapsed session lands. The page read throws only when there is
			// no identity at all, and that is what a cleared auth looks like after the JWT exchange
			// stops answering. Everything else here is the connection.
			const info = deps.session_expired() ? DEATH_SESSION_EXPIRED : DEATH_UNAVAILABLE;
			if (info === DEATH_UNAVAILABLE) {
				console.error("[bonobo-plugin-sdk] Plugin data window interval failed:", outcome.queryError);
			}
			kill(info);
			return;
		}
		// null is the store's denial/revocation answer, and one dead interval kills the whole
		// window: a flattened list with a silently missing range would lie to the page.
		if (outcome.value === null) {
			kill(DEATH_DENIED);
			return;
		}

		interval.previousFirstKey = interval.docs?.[0]?.key;
		interval.previousDocs = interval.docs;
		interval.docs = outcome.value.docs;
		interval.truncated = outcome.value.truncated;
		if (state.awaitingTail === interval) {
			state.awaitingTail = null;
			state.loadingOlder = false;
		}

		if (state.pending?.replacements.includes(interval)) {
			if (state.pending.replacements.every((replacement) => replacement.docs !== null)) {
				commit_pending();
			}
			return;
		}

		schedule_flush();
		reconcile();
	};

	// START: one unbounded subscription, exactly the shape of a plain capped watch. The window
	// machinery only engages when this first interval reports truncated.
	/** @type {DocumentsWindowInterval} */
	const head = {
		start: null,
		end: null,
		docs: null,
		truncated: false,
		previousFirstKey: undefined,
		previousDocs: null,
		stop: () => {},
	};
	if (!start_interval(head)) {
		return null;
	}
	state.intervals.push(head);

	return {
		load_older: () => {
			if (state.dead) {
				return;
			}
			// Queue behind a pending swap; everything else re-checks inside execute_load_older.
			if (state.pending) {
				state.queuedLoadOlder = true;
				return;
			}
			execute_load_older();
		},
		dispose: () => {
			if (state.dead) {
				return;
			}
			stop_all();
		},
	};
}

/**
 * Builds the client's `data`, `members` and `scopes` APIs over an injectable reactive-read primitive.
 * `bonobo_ui_connect` wires it to the page's own Convex client. Plugin code should use the client
 * from `bonobo_ui_connect`, never call this directly — which is why this is NOT exported. The
 * package publishes `frontend.js` next to a hand-written `frontend.d.ts`, and nothing compares
 * the two (`typecheck` runs `tsc --skipLibCheck` over `frontend.js` alone), so an `export` here
 * would ship a runtime symbol the type surface does not declare. The SDK test suite reaches this
 * through `bonobo_ui_connect` and drives the seam from the fake Convex client instead.
 *
 * The `start_watch` dep starts one reactive read of the plugin's document store. `onResult`
 * receives `{ value }` (the query answer — `null` is the store's denial) or `{ queryError }`,
 * and results NEVER arrive synchronously from the start call, cached ones included. It returns
 * `{ dispose }`, or `null` when the read cannot start at all.
 *
 * @param {{
 *   start_watch: DataStartWatch,
 *   start_recent_watch: (queryArgs: Record<string, unknown>, onResult: (outcome: { value: { docs: import("bonobo-plugin-sdk").BonoboPublicDoc[], truncated: boolean } | null } | { queryError: unknown }) => void) => { dispose: () => void } | null,
 *   start_changes_watch: (queryArgs: Record<string, unknown>, onResult: (outcome: { value: { docs: import("bonobo-plugin-sdk").BonoboPublicDoc[], truncated: boolean } | null } | { queryError: unknown }) => void) => { dispose: () => void } | null,
 *   run_user_write: (op: "append" | "put" | "remove" | "putOwned" | "removeOwned", fields: Record<string, unknown>) => Promise<unknown>,
 *   resolve_member_display: (userIds: string[]) => Promise<{ members: Record<string, string | null> } | null>,
 *   list_members: (limit: number, cursor: string | null) => Promise<{ members: import("bonobo-plugin-sdk/frontend").BonoboUiMember[], cursor: string | null } | { refusal: string } | null>,
 *   run_manage_scope: (action: Record<string, unknown>) => Promise<unknown>,
 *   list_scope_principals: (scopeId: string) => Promise<import("bonobo-plugin-sdk/frontend").BonoboUiScopePrincipal[] | null>,
 *   start_my_scopes_watch: (onResult: (outcome: { value: import("bonobo-plugin-sdk/frontend").BonoboUiScope[] | null } | { queryError: unknown }) => void) => { dispose: () => void } | null,
 *   session_expired: () => boolean,
 * }} deps
 * @returns {{ data: import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["data"], members: import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["members"], scopes: import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["scopes"] }}
 */
function bonobo_ui_create_data_api(deps) {
	// Live page-visible subscriptions: a plain watch and a document window each hold one entry.
	/** @type {Set<object>} */
	const registrations = new Set();

	let serverSubscriptionCount = 0;
	const acquire_server_slot = () => {
		if (serverSubscriptionCount >= MAX_PAGE_SERVER_SUBSCRIPTIONS) {
			return false;
		}
		serverSubscriptionCount += 1;
		return true;
	};
	const release_server_slot = () => {
		serverSubscriptionCount -= 1;
	};
	// `requiredSlots` defaults to 1, which is the same test as `count >= MAX`. A caller that is about
	// to start more than one watcher passes how many it needs, so it can tell "no room at all" apart
	// from "no room for the pair I am about to start".
	/** @param {number} [requiredSlots] */
	const page_at_ceiling = (requiredSlots = 1) =>
		serverSubscriptionCount + requiredSlots > MAX_PAGE_SERVER_SUBSCRIPTIONS;

	// A death decided right in the watch call still must arrive like a real one: after the
	// caller has its unsubscribe handle, on the same async timing a cached server answer has.
	/**
	 * @param {(docs: null, info?: { reason: string, message: string }) => void} onUpdate
	 * @param {{ reason: string, message: string }} [info]
	 */
	const deliver_death_async = (onUpdate, info) => {
		setTimeout(() => {
			if (info) {
				onUpdate(null, info);
			} else {
				onUpdate(null);
			}
		}, 0);
	};

	/** @param {(docs: null, info?: { reason: string, message: string }) => void} onUpdate */
	const refuse_capacity = (onUpdate) => {
		console.warn("[bonobo-plugin-sdk] Data watch refused, subscription cap reached");
		deliver_death_async(onUpdate, { reason: "capacity", message: "Subscription limit reached for this plugin frame" });
	};

	/**
	 * Hold one page-visible subscription and turn every way it can end into the page's death
	 * callback.
	 *
	 * Two doors need this and they must not drift: a missed `release_server_slot` leaks a slot the
	 * page never gets back, and the frame then refuses later watches for no visible reason. `start`
	 * owns what is being read; everything here is the bookkeeping around it.
	 *
	 * @template TValue, TPayload
	 * @param {{
	 *   start: (onOutcome: (outcome: { value: TValue | null } | { queryError: unknown }) => void) => { dispose: () => void } | null,
	 *   onUpdate: (payload: TPayload | null, info?: { reason: string, message: string }) => void,
	 *   deliver: (value: TValue) => TPayload,
	 *   failureLabel: string,
	 * }} args
	 * @returns {() => void}
	 */
	const start_registered_watch = (args) => {
		if (registrations.size >= MAX_WATCH_SUBSCRIPTIONS || page_at_ceiling()) {
			refuse_capacity(args.onUpdate);
			return () => {};
		}
		// The ceiling was checked synchronously above, so this slot take cannot fail; a false
		// here would still be a capacity refusal.
		if (!acquire_server_slot()) {
			refuse_capacity(args.onUpdate);
			return () => {};
		}

		const entry = {};
		registrations.add(entry);
		/** @type {{ dispose: () => void } | null} */
		let subscription = null;
		// Death and unsubscribe share this: the registration entry decides liveness, so a
		// late delivery or a second unsubscribe after either path is a no-op.
		const stop = () => {
			if (!registrations.delete(entry)) {
				return;
			}
			subscription?.dispose();
			release_server_slot();
		};
		subscription = args.start((outcome) => {
			if (!registrations.has(entry)) {
				return;
			}
			if ("queryError" in outcome) {
				// Same split as the window: a session that ran out is the ordinary end of a
				// frame, and only a real transport failure deserves an error line.
				const info = deps.session_expired() ? DEATH_SESSION_EXPIRED : DEATH_UNAVAILABLE;
				if (info === DEATH_UNAVAILABLE) {
					console.error(`[bonobo-plugin-sdk] Plugin ${args.failureLabel} failed:`, outcome.queryError);
				}
				stop();
				args.onUpdate(null, info);
				return;
			}
			// null is the store's denial/revocation answer: the subscription is dead and
			// its resources are released before the page hears the death.
			if (outcome.value === null) {
				stop();
				args.onUpdate(null, DEATH_DENIED);
				return;
			}
			args.onUpdate(args.deliver(outcome.value));
		});
		if (!subscription) {
			stop();
			console.error(`[bonobo-plugin-sdk] Plugin ${args.failureLabel} could not start`);
			deliver_death_async(args.onUpdate);
			return () => {};
		}
		return function unsubscribe() {
			stop();
		};
	};

	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["data"]} */
	const data = {
		watch(opts, onUpdate) {
			// Refusals decided here carry a reason so the page can tell bad args and full caps
			// from a denial; inputs outside the client-side subset still go to the server and
			// die as a bare null.
			const invalid = validate_watch_inputs({
				collection: opts.collection,
				...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
				limit: opts.limit,
			});
			if (invalid) {
				deliver_death_async(onUpdate, { reason: "invalid", message: invalid });
				return () => {};
			}
			return start_registered_watch({
				start: (onOutcome) =>
					deps.start_watch(
						{
							collection: opts.collection,
							...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
							limit: opts.limit,
						},
						null,
						onOutcome,
					),
				onUpdate,
				// The store already computes `truncated`, and dropping it here is what made the
				// 101st document vanish with no sign. Deliver a payload object, the same shape
				// `watchWindow` delivers, so parameter 2 stays reserved for death info.
				deliver: (value) => ({ docs: value.docs, truncated: value.truncated }),
				failureLabel: "data watch",
			});
		},
		watchRecent(opts, onUpdate) {
			// Creation-time order, which key order cannot answer for keys that carry no timestamp.
			// The direction/fencepost pairing (`since` with ascending, `before` with descending) is
			// judged by the server, where a violation dies as a bare null like any other bad input.
			const invalid = validate_watch_inputs({ collection: opts.collection, limit: opts.limit });
			if (invalid) {
				deliver_death_async(onUpdate, { reason: "invalid", message: invalid });
				return () => {};
			}
			return start_registered_watch({
				start: (onOutcome) =>
					deps.start_recent_watch(
						{
							collection: opts.collection,
							limit: opts.limit,
							...(opts.order === undefined ? {} : { order: opts.order }),
							...(opts.since === undefined ? {} : { since: opts.since }),
							...(opts.before === undefined ? {} : { before: opts.before }),
							...(opts.scopeId === undefined ? {} : { scopeId: opts.scopeId }),
						},
						onOutcome,
					),
				onUpdate,
				deliver: (value) => ({ docs: value.docs, truncated: value.truncated }),
				failureLabel: "recent watch",
			});
		},
		watchChanges(opts, onUpdate) {
			// Update-time order: an edit or a soft-delete of an old document surfaces here. Creation
			// order cannot answer that, which is why this is not `watchRecent`. `updatedSince` is an
			// inclusive fence: copy the newest applied `updatedAt` as-is so a same-millisecond sibling
			// is not lost. If a truncated delivery is still on that millisecond, pass `newest + 1` so
			// the live query can leave those 100 rows. The server judges `updatedSince` and `scopeId`;
			// a bad number dies as a bare null like any other refused read.
			const invalid = validate_watch_inputs({ collection: opts.collection, limit: opts.limit });
			if (invalid) {
				deliver_death_async(onUpdate, { reason: "invalid", message: invalid });
				return () => {};
			}
			return start_registered_watch({
				start: (onOutcome) =>
					deps.start_changes_watch(
						{
							collection: opts.collection,
							limit: opts.limit,
							...(opts.updatedSince === undefined ? {} : { updatedSince: opts.updatedSince }),
							...(opts.scopeId === undefined ? {} : { scopeId: opts.scopeId }),
						},
						onOutcome,
					),
				onUpdate,
				deliver: (value) => ({ docs: value.docs, truncated: value.truncated }),
				failureLabel: "changes watch",
			});
		},
		watchWindow(opts, onUpdate) {
			const inertHandle = { loadOlder() {}, unsubscribe() {} };
			const invalid = validate_watch_inputs({
				collection: opts.collection,
				...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
				limit: opts.pageSize,
			});
			if (invalid) {
				deliver_death_async(onUpdate, { reason: "invalid", message: invalid });
				return inertHandle;
			}
			if (registrations.size >= MAX_WATCH_SUBSCRIPTIONS || page_at_ceiling()) {
				refuse_capacity(onUpdate);
				return inertHandle;
			}

			// Register before creating: the head's first delivery can be a cached denial that
			// kills the window right after this call returns, and the kill path must find the
			// entry to remove it.
			const entry = {};
			registrations.add(entry);
			const documentsWindow = create_documents_window({
				queryArgs: {
					collection: opts.collection,
					...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
					limit: opts.pageSize,
				},
				start_watch: deps.start_watch,
				acquire_server_slot,
				release_server_slot,
				page_at_ceiling,
				post_update: (payload) => onUpdate(payload),
				on_dead: (info) => {
					registrations.delete(entry);
					onUpdate(null, info);
				},
				session_expired: deps.session_expired,
			});
			if (!documentsWindow) {
				registrations.delete(entry);
				console.error("[bonobo-plugin-sdk] Plugin data window could not start");
				deliver_death_async(onUpdate);
				return inertHandle;
			}
			return {
				loadOlder() {
					// A dead or unsubscribed window grows nothing.
					if (registrations.has(entry)) {
						documentsWindow.load_older();
					}
				},
				unsubscribe() {
					// Same discipline as the plain watch: the entry decides liveness once.
					if (registrations.delete(entry)) {
						documentsWindow.dispose();
					}
				},
			};
		},
		append(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataAppendResult>} */ (
				run_write("append", {
					collection: opts.collection,
					...(opts.keyPrefix === undefined ? {} : { keyPrefix: opts.keyPrefix }),
					value: opts.value,
					...(opts.clientRequestId === undefined ? {} : { clientRequestId: opts.clientRequestId }),
				})
			);
		},
		put(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataPutResult>} */ (
				run_write("put", {
					collection: opts.collection,
					key: opts.key,
					value: opts.value,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
		remove(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataRemoveResult>} */ (
				run_write("remove", {
					collection: opts.collection,
					key: opts.key,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
		putOwned(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataPutOwnedResult>} */ (
				run_write("putOwned", {
					collection: opts.collection,
					key: opts.key,
					value: opts.value,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
		removeOwned(opts) {
			return /** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiDataRemoveResult>} */ (
				run_write("removeOwned", {
					collection: opts.collection,
					key: opts.key,
					...(opts.expectedRevision === undefined ? {} : { expectedRevision: opts.expectedRevision }),
				})
			);
		},
	};

	/**
	 * Every write resolves with the store door's Result as-is, `_yay` and `_nay` alike. A thrown
	 * call (network loss, a payload the Convex client cannot serialize) resolves the stable
	 * generic `_nay`; the real cause stays in the log.
	 *
	 * @param {"append" | "put" | "remove" | "putOwned" | "removeOwned"} op
	 * @param {Record<string, unknown>} fields
	 */
	function run_write(op, fields) {
		return Promise.resolve()
			.then(() => deps.run_user_write(op, fields))
			.catch((error) => {
				console.error("[bonobo-plugin-sdk] Plugin data write failed:", error);
				return { _nay: { message: "Failed to write plugin data" } };
			});
	}

	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["members"]} */
	const members = {
		resolve(userIds) {
			return Promise.resolve()
				.then(() => deps.resolve_member_display(userIds))
				.then((result) => {
					// A null answer is a denial; the page sees an empty map, not an error.
					return result === null ? {} : result.members;
				})
				.catch((error) => {
					console.error("[bonobo-plugin-sdk] Failed to resolve plugin member names:", error);
					return {};
				});
		},
		list(opts) {
			// Checked here so a bad limit costs no round trip, the same way `data.watch` refuses one.
			if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > MEMBERS_MAX_LIST_PAGE_SIZE) {
				return Promise.resolve({
					_nay: { name: "invalid", message: `Member list limits must be integers from 1 to ${MEMBERS_MAX_LIST_PAGE_SIZE}` },
				});
			}

			return Promise.resolve()
				.then(() => deps.list_members(opts.limit, opts.cursor ?? null))
				.then((result) => {
					// None of the three refusals below may answer an empty roster. A page that reads
					// `members: []` tells the member this workspace has nobody in it, and the one refusal
					// an admin can actually fix would never be seen.
					if (result === null) {
						return { _nay: { name: DEATH_DENIED.reason, message: "This plugin no longer has access to this workspace" } };
					}
					if ("refusal" in result) {
						return {
							_nay: {
								name: "not_consented",
								message: "This workspace has not granted this plugin the member list",
							},
						};
					}
					return { _yay: { members: result.members, cursor: result.cursor } };
				})
				.catch((error) => {
					// Same split as a watch death: a session that ran out is the ordinary end of a frame,
					// and only a real transport failure deserves an error line.
					const info = deps.session_expired() ? DEATH_SESSION_EXPIRED : DEATH_UNAVAILABLE;
					if (info === DEATH_UNAVAILABLE) {
						console.error("[bonobo-plugin-sdk] Failed to list plugin workspace members:", error);
					}
					return { _nay: { name: info.reason, message: info.message } };
				});
		},
	};

	/**
	 * Runs one scope change. Same resolve-never-reject contract as a data write, and the same
	 * stable fallback message, because the page shows both in the same dialogs.
	 *
	 * @param {Record<string, unknown>} action
	 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiScopeResult>}
	 */
	function run_scope(action) {
		return Promise.resolve()
			.then(() => deps.run_manage_scope(action))
			.then((result) => /** @type {import("bonobo-plugin-sdk/frontend").BonoboUiScopeResult} */ (result))
			.catch((error) => {
				console.error("[bonobo-plugin-sdk] Plugin scope change failed:", error);
				return { _nay: { message: "Failed to change who can read this" } };
			});
	}

	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient["scopes"]} */
	const scopes = {
		create(opts) {
			return run_scope({
				kind: "create",
				scopeId: opts.scopeId,
				collections: opts.collections,
				keyPrefix: opts.keyPrefix,
			});
		},
		setPrincipal(opts) {
			return run_scope({ kind: "set_principal", scopeId: opts.scopeId, userId: opts.userId, level: opts.level });
		},
		removePrincipal(opts) {
			return run_scope({ kind: "remove_principal", scopeId: opts.scopeId, userId: opts.userId });
		},
		delete(opts) {
			return run_scope({ kind: "delete", scopeId: opts.scopeId });
		},
		listPrincipals(opts) {
			return Promise.resolve()
				.then(() => deps.list_scope_principals(opts.scopeId))
				.catch((error) => {
					// Null already means "this scope is not yours to see", so a failed read answers the
					// same thing rather than inventing an empty share list.
					console.error("[bonobo-plugin-sdk] Failed to read plugin scope principals:", error);
					return null;
				});
		},
		watchMine(onUpdate) {
			// This is live, not a one-shot read, and that is the point: when somebody adds this member
			// to a private range, the page has to show it without a reload. It holds one subscription
			// slot like any other watch.
			return start_registered_watch({
				start: (onOutcome) => deps.start_my_scopes_watch(onOutcome),
				onUpdate,
				deliver: (value) => value,
				failureLabel: "scope watch",
			});
		},
	};

	return { data, members, scopes };
}

/**
 * Wires the data api's deps to the page's own Convex client.
 *
 * - `start_watch` adapts the client's `onUpdate`: the client delivers an already-cached result
 *   on a `setTimeout(0)`, so results never come back synchronously from the start call —
 *   exactly the delivery contract `bonobo_ui_create_data_api` requires. `onError` is always
 *   passed, because without it the client turns a query error into an unhandled rejection
 *   instead of a callback.
 * - The write and member doors read everything else they need from the session named by the
 *   JWT, so the args carry only the operation itself.
 *
 * @param {import("convex/browser").ConvexClient} convexClient
 */
function create_convex_data_deps(convexClient) {
	/** @type {DataStartWatch} */
	const start_watch = (queryArgs, bounds, onResult) => {
		try {
			const unsubscribe = convexClient.onUpdate(
				anyApi.plugins_data.watch_documents,
				{
					...queryArgs,
					...(bounds?.keyStartExclusive === undefined ? {} : { keyStartExclusive: bounds.keyStartExclusive }),
					...(bounds?.keyEndInclusive === undefined ? {} : { keyEndInclusive: bounds.keyEndInclusive }),
				},
				(value) => onResult({ value }),
				(queryError) => onResult({ queryError }),
			);
			return { dispose: () => void unsubscribe() };
		} catch {
			return null;
		}
	};

	return {
		start_watch,
		/**
		 * @param {Record<string, unknown>} queryArgs
		 * @param {(outcome: { value: any } | { queryError: unknown }) => void} onResult
		 */
		start_recent_watch: (queryArgs, onResult) => {
			try {
				const unsubscribe = convexClient.onUpdate(
					anyApi.plugins_data.watch_recent,
					queryArgs,
					(value) => onResult({ value }),
					(queryError) => onResult({ queryError }),
				);
				return { dispose: () => void unsubscribe() };
			} catch {
				return null;
			}
		},
		/**
		 * @param {Record<string, unknown>} queryArgs
		 * @param {(outcome: { value: any } | { queryError: unknown }) => void} onResult
		 */
		start_changes_watch: (queryArgs, onResult) => {
			try {
				const unsubscribe = convexClient.onUpdate(
					anyApi.plugins_data.watch_changes,
					queryArgs,
					(value) => onResult({ value }),
					(queryError) => onResult({ queryError }),
				);
				return { dispose: () => void unsubscribe() };
			} catch {
				return null;
			}
		},
		/**
		 * @param {"append" | "put" | "remove" | "putOwned" | "removeOwned"} op
		 * @param {Record<string, unknown>} fields
		 */
		run_user_write: (op, fields) => {
			switch (op) {
				case "append":
					return convexClient.mutation(anyApi.plugins_data.user_append_document, fields);
				case "put":
					return convexClient.mutation(anyApi.plugins_data.user_put_document, fields);
				case "remove":
					return convexClient.mutation(anyApi.plugins_data.user_remove_document, fields);
				case "putOwned":
					return convexClient.mutation(anyApi.plugins_data.user_put_owned_document, fields);
				case "removeOwned":
					return convexClient.mutation(anyApi.plugins_data.user_remove_owned_document, fields);
			}
		},
		/** @param {string[]} userIds */
		resolve_member_display: (userIds) => convexClient.query(anyApi.plugins_data.resolve_member_display, { userIds }),
		/**
		 * @param {number} limit
		 * @param {string | null} cursor
		 */
		list_members: (limit, cursor) => convexClient.query(anyApi.plugins_data.list_members, { limit, cursor }),
		/** @param {Record<string, unknown>} action */
		run_manage_scope: (action) => convexClient.mutation(anyApi.plugins_data.user_manage_scope, { action }),
		/** @param {string} scopeId */
		list_scope_principals: (scopeId) => convexClient.query(anyApi.plugins_data.watch_scope_principals, { scopeId }),
		/** @param {(outcome: { value: any } | { queryError: unknown }) => void} onResult */
		start_my_scopes_watch: (onResult) => {
			try {
				const unsubscribe = convexClient.onUpdate(
					anyApi.plugins_data.watch_my_scopes,
					{},
					(value) => onResult({ value }),
					(queryError) => onResult({ queryError }),
				);
				return { dispose: () => void unsubscribe() };
			} catch {
				return null;
			}
		},
	};
}

/**
 * Connects the page to the embedding host app. It installs one shared `message` listener (for
 * init and token responses), posts `{ type: "bonobo:ready", bridgeNonce }` to `window.parent`,
 * and resolves with the frontend client when the host's `bonobo:init` arrives. `bonobo:init`
 * messages after the first are ignored.
 *
 * The host puts its canonical HTTP(S) origin and a fresh frame nonce in the URL fragment. The SDK
 * validates both before connecting, sends ready only to that exact origin, and accepts host
 * messages only from that origin, `window.parent`, and the matching nonce. The session token
 * travels over postMessage only and is never placed in a URL.
 *
 * On init the SDK also opens the page's own Convex client against the init's `convexUrl`. The
 * client authenticates with short-lived plugin-session JWTs minted by exchanging the session
 * token at the same-origin `/plugins-ui/session-jwt` route; the `data` and `members` APIs run on
 * that client directly.
 *
 * @returns {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>}
 */
export async function bonobo_ui_connect() {
	const { parentOrigin, bridgeNonce } = read_bridge_bootstrap();

	// Token state — set by `bonobo:init`, updated by `bonobo:token` and the JWT exchange.
	let apiOrigin = "";
	let token = "";
	let tokenExpiresAt = 0;

	// Theme state — set by `bonobo:init`, replaced by `bonobo:theme` when the member switches the
	// host's theme. It stays null when the host sends none, so an older host keeps working and the
	// page can fall back to its own colours.
	/** @type {import("bonobo-plugin-sdk/frontend").BonoboUiTheme | null} */
	let theme = null;
	/** @type {Set<(theme: import("bonobo-plugin-sdk/frontend").BonoboUiTheme) => void>} */
	const themeSubscribers = new Set();

	/** @type {Map<string, { resolve: (token: string) => void, reject: (error: Error) => void, timeout: ReturnType<typeof setTimeout> }>} */
	const pending_refreshes = new Map();
	/** @type {Promise<string> | null} */
	let refresh_in_flight = null;

	/**
	 * Returns the current session token, refreshing it first when it is expired or within
	 * `TOKEN_EXPIRY_MARGIN_MS` of `tokenExpiresAt`.
	 *
	 * @returns {Promise<string>}
	 */
	async function getToken() {
		if (Date.now() >= tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS) {
			return refreshToken();
		}
		return token;
	}

	/**
	 * Asks the host for a fresh session token. Concurrent callers share one in-flight
	 * `bonobo:token-refresh-request`; it resolves on the matching `bonobo:token` and rejects on
	 * the matching `bonobo:token-error`.
	 *
	 * @returns {Promise<string>}
	 */
	function refreshToken() {
		if (refresh_in_flight) {
			return refresh_in_flight;
		}
		const requestId = crypto.randomUUID();
		refresh_in_flight = new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				pending_refreshes.delete(requestId);
				reject(new Error("Plugin frame token refresh timed out"));
			}, REFRESH_DEADLINE_MS);
			pending_refreshes.set(requestId, { resolve, reject, timeout });
			try {
				window.parent.postMessage(
					{ type: "bonobo:token-refresh-request", bridgeNonce, requestId },
					parentOrigin,
				);
			} catch (error) {
				clearTimeout(timeout);
				pending_refreshes.delete(requestId);
				reject(error);
			}
		}).finally(() => {
			refresh_in_flight = null;
		});
		return refresh_in_flight;
	}

	/**
	 * `fetch` against `apiOrigin + path` with `Authorization: Bearer <token>`. When `init.body`
	 * is set it is JSON-encoded and sent with `Content-Type: application/json`, and the default
	 * method is `POST`; without a body the default method is `GET`. On a `401` the client
	 * refreshes the token and retries exactly once. Ok responses resolve with the parsed JSON
	 * body; non-ok responses throw an `Error` carrying `status` and `responseText`.
	 *
	 * @param {string} path - Public API path starting with `/`, e.g. `"/api/v1/files/list"`.
	 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [init]
	 * @returns {Promise<unknown>}
	 */
	async function fetchJson(path, init) {
		const has_body = init?.body !== undefined;
		/** @param {string} bearer */
		const send = (bearer) => {
			const headers = new Headers(init?.headers);
			headers.set("Authorization", `Bearer ${bearer}`);
			if (has_body) {
				headers.set("Content-Type", "application/json");
			}
			return fetch(apiOrigin + path, {
				method: init?.method ?? (has_body ? "POST" : "GET"),
				headers,
				body: has_body ? JSON.stringify(init.body) : undefined,
			});
		};

		const firstBearer = await getToken();
		let response = await send(firstBearer);
		if (response.status === 401) {
			// Another request may already have rotated this captured bearer. Reuse the current
			// token in that case so a late 401 cannot rotate the fresh token again.
			response = await send(token !== firstBearer ? token : await refreshToken());
		}
		if (!response.ok) {
			const responseText = await response.text();
			throw Object.assign(new Error(`${path} responded ${response.status}: ${responseText}`), {
				status: response.status,
				responseText,
			});
		}
		return response.json();
	}

	/**
	 * Exchanges the session token for a short-lived plugin-session JWT at the asset origin's
	 * `/plugins-ui/session-jwt` route. For a published frame this is a same-origin JSON POST with
	 * no preflight, and the route answers no other origin, so the JWT never becomes readable
	 * cross-origin. The one exception is the app's development-only frame override: a dev
	 * deployment may allowlist exactly one extra origin for this route, and the same POST then
	 * runs preflighted from there.
	 *
	 * @param {string} sessionToken
	 */
	const exchange_session_jwt = (sessionToken) =>
		fetch(apiOrigin + "/plugins-ui/session-jwt", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ token: sessionToken }),
		});

	/**
	 * The Convex client's auth callback. Every call mints a fresh JWT, so a repeated call never
	 * hands back a stale one.
	 *
	 * This chain is also what keeps an open healthy page alive: `getToken()` refreshes the
	 * session token through the host when the session is within 60 seconds of its expiry, and
	 * that host refresh EXTENDS the session and moves its scheduled deletion. A page that slept
	 * past the session expiry cannot recover here — the session doc is gone, every path below
	 * answers null, and null tells the Convex client this page is unauthenticated (its
	 * subscriptions die; the host frame's Retry or a reload mints a fresh session).
	 */
	async function fetch_convex_jwt() {
		// A transient failure must not answer null: the Convex client treats one null as a final
		// "unauthenticated" and never asks again, so a two-second network blip or a 429 from the
		// exchange bucket would kill the page for good. Retry the transient shapes (thrown fetch,
		// 429, 5xx) a few times before giving up; a hard refusal still answers null right away.
		for (let attempt = 0; ; attempt += 1) {
			/** @type {Response | null} */
			let response = null;
			try {
				response = await exchange_session_jwt(await getToken());
				if (response.status === 401) {
					// The session went stale between the margin check and the exchange (for example
					// the device slept briefly). One host refresh, one re-exchange; a second refusal
					// means the session is gone.
					response = await exchange_session_jwt(await refreshToken());
				}
			} catch {
				response = null;
			}

			if (response?.ok) {
				const body = await response.json().catch(() => null);
				const jwt = body?._yay?.jwt;
				const sessionExpiresAt = body?._yay?.sessionExpiresAt;
				if (typeof jwt !== "string" || typeof sessionExpiresAt !== "number") {
					return null;
				}
				// Keep the stored expiry in sync with the server's view of the session, so
				// getToken's refresh margin stays anchored to the real session end.
				tokenExpiresAt = sessionExpiresAt;
				return jwt;
			}

			const transient = response === null || response.status === 429 || response.status >= 500;
			if (!transient || attempt >= 2) {
				return null;
			}
			await new Promise((resolveWait) => setTimeout(resolveWait, 1000 * (attempt + 1)));
		}
	}

	/** @type {Promise<import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient>} */
	const client_promise = new Promise((resolve) => {
		let initialized = false;
		/** @type {ReturnType<typeof setInterval> | undefined} */
		let readyInterval;

		const post_ready = () => {
			window.parent.postMessage({ type: "bonobo:ready", bridgeNonce }, parentOrigin);
		};

		const stop_ready = () => {
			clearInterval(readyInterval);
		};

		/** @param {MessageEvent} event */
		const handle_message = (event) => {
			if (event.source !== window.parent || event.origin !== parentOrigin) {
				return;
			}
			const message = event.data;
			if (typeof message !== "object" || message === null) {
				return;
			}
			if (
				message.type === "bonobo:init" &&
				!initialized &&
				message.bridgeNonce === bridgeNonce &&
				typeof message.apiOrigin === "string" &&
				typeof message.convexUrl === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt) &&
				is_ui_context(message.context)
			) {
				initialized = true;
				stop_ready();
				window.removeEventListener("pagehide", stop_ready);
				apiOrigin = message.apiOrigin;
				token = message.token;
				tokenExpiresAt = message.tokenExpiresAt;
				// The page talks to Convex itself. expectAuth keeps queries parked until the
				// first JWT arrives, so a subscription never runs an unauthenticated round first.
				const convexClient = new ConvexClient(message.convexUrl, { expectAuth: true, unsavedChangesWarning: false });
				convexClient.setAuth(fetch_convex_jwt);
				// The document is going away (unload or bfcache). Close the client so the server
				// drops this page's subscriptions; a page restored from bfcache stays frozen and
				// needs a reload.
				window.addEventListener("pagehide", () => void convexClient.close(), { once: true });
				theme = read_theme(message.theme);
				const { data, members, scopes } = bonobo_ui_create_data_api({
					...create_convex_data_deps(convexClient),
					// The one thing that tells a lapsed session apart from a broken connection. The
					// server answers the same opaque null for both, so this clock is the whole
					// difference, and it lives in this closure.
					session_expired: () => Date.now() >= tokenExpiresAt,
				});
				resolve({
					context: message.context,
					apiOrigin,
					getToken,
					refreshToken,
					fetchJson,
					data,
					members,
					scopes,
					theme: {
						current: () => theme,
						subscribe(onChange) {
							themeSubscribers.add(onChange);
							return () => {
								themeSubscribers.delete(onChange);
							};
						},
					},
				});
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:token" &&
				typeof message.requestId === "string" &&
				typeof message.token === "string" &&
				typeof message.tokenExpiresAt === "number" &&
				Number.isFinite(message.tokenExpiresAt)
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					token = message.token;
					tokenExpiresAt = message.tokenExpiresAt;
					pending.resolve(message.token);
				}
			} else if (initialized && message.bridgeNonce === bridgeNonce && message.type === "bonobo:theme") {
				const next = read_theme(message.theme);
				if (next) {
					theme = next;
					for (const onChange of themeSubscribers) {
						onChange(next);
					}
				}
			} else if (
				initialized &&
				message.bridgeNonce === bridgeNonce &&
				message.type === "bonobo:token-error" &&
				typeof message.requestId === "string" &&
				typeof message.message === "string"
			) {
				const pending = pending_refreshes.get(message.requestId);
				if (pending) {
					pending_refreshes.delete(message.requestId);
					clearTimeout(pending.timeout);
					pending.reject(new Error(message.message));
				}
			}
			// Anything else (unknown types, replayed inits, stray requestIds) is silently ignored.
		};

		window.addEventListener("message", handle_message);
		window.addEventListener("pagehide", stop_ready, { once: true });
		post_ready();
		readyInterval = setInterval(post_ready, READY_RETRY_MS);
	});

	return client_promise;
}
