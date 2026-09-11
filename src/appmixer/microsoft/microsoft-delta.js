'use strict';

const commons = require('./microsoft-commons');

// Maximum number of Microsoft Graph `delta` pages processed by a single receive()/tick()
// invocation. Without a cap, a large delta backlog (a site with many files, a flow restarted
// after a long stop) keeps the component lock held for as long as Graph needs to page through
// it, which starves tick()/start() with LockError storms and livelocks on redelivery.
const MAX_PAGES_PER_RUN = 20;

// TTL the component lock is (re)armed with around every Graph call and while emitting. It has
// to comfortably cover one `delta` call including the HTTP timeout in microsoft-commons,
// otherwise the lock silently expires mid-run and a concurrent run can write state over it.
const LOCK_TTL = 60 * 1000;

// While a page is being emitted the lock is re-armed once the last extension is older than
// this. Time based on purpose: how long N emissions take depends on the engine, not on N.
const LOCK_REARM_AFTER = LOCK_TTL / 3;

// Page cap for the read-only Flow Test Mode enumeration. test() walks the delta chain from the
// beginning (it deliberately has no baseline link to resume from), so it needs a lot more
// headroom than a single locked run - but it still has to be bounded, because it blocks an
// interactive request and holds no lock that would protect it.
const TEST_MODE_MAX_PAGES = 100;

// State flag telling tick() that there is more of the delta backlog to work through, either
// because this run hit MAX_PAGES_PER_RUN, could not get the component lock, or failed on
// something worth retrying.
const SKIPPED_FLAG = 'hasSkippedMessage';

// State key holding when the delta chain that is currently being consumed was started. It is
// carried across capped continuations and cleared once the chain is drained.
const CHAIN_STARTED_KEY = 'deltaChainStartedAt';

// State key and size of the memory of recently emitted item ids (see createEmittedIds()).
const EMITTED_IDS_KEY = 'recentFileIds';
const MAX_EMITTED_IDS = 1000;

/**
 * Raised when the component lock could no longer be extended. Processing must stop rather than
 * continue unprotected - progress is durable, so the next tick() resumes where we left off.
 */
class LockLostError extends Error {}

/**
 * Whether a failed `context.lock()` means that somebody else holds the lock, as opposed to the
 * lock itself being broken (e.g. the lock store being unreachable). The engine lock is
 * Redlock based and gives up on a held resource with
 * `LockError: Exceeded <n> attempts to lock the resource`.
 * @param {Error} err
 * @return {boolean}
 */
const isLockContentionError = (err) => {

    return err?.name === 'LockError' || /attempts to lock the resource/i.test(err?.message || '');
};

/**
 * Graph answers `410 Gone` (`resyncRequired`) once a stored delta link is no longer valid.
 * @param {Error} err
 * @return {boolean}
 */
const isResyncRequired = (err) => err?.statusCode === 410;

/**
 * Whether a failed delta scan is worth retrying from the next tick(): network failures and
 * timeouts (no status), throttling and Graph-side errors. Any other 4xx - a revoked
 * permission, a deleted drive - would fail the very same way every minute.
 * @param {Error} err
 * @return {boolean}
 */
const isTransientError = (err) => {

    const status = err?.statusCode;
    return !status || status === 408 || status === 429 || status >= 500;
};

/**
 * Re-arm the component lock. Throws LockLostError when the lock is already gone so that
 * callers abort instead of silently carrying on without mutual exclusion. `lease` tracks when
 * the lock was last (re)armed so that extendLockIfStale() can re-arm on elapsed time.
 * @param {Object} lock
 * @param {Object} [lease]
 * @return {Promise<void>}
 */
const extendLock = async (lock, lease) => {

    try {
        await lock.extend(LOCK_TTL);
    } catch (err) {
        throw new LockLostError(`Cannot extend the Microsoft component lock: ${err.message}`);
    }
    if (lease) {
        lease.armedAt = Date.now();
    }
};

/**
 * Re-arm the lock only when the last extension is older than LOCK_REARM_AFTER. Cheap enough to
 * call after every single emission.
 * @param {Object} lock
 * @param {Object} lease
 * @return {Promise<void>}
 */
const extendLockIfStale = async (lock, lease) => {

    if (Date.now() - lease.armedAt >= LOCK_REARM_AFTER) {
        await extendLock(lock, lease);
    }
};

/**
 * Release the lock without ever masking the error that is already propagating: neither the
 * unlock nor the best-effort log of its failure may throw out of a `finally` block.
 * @param {Object} context
 * @param {Object} lock
 * @return {Promise<void>}
 */
const safeUnlock = async (context, lock) => {

    if (!lock) return;
    try {
        await lock.unlock();
    } catch (err) {
        try {
            await context.log({ step: 'unlock-failed', error: err.message });
        } catch (logErr) {
            // Nothing left to report to; the original outcome wins.
        }
    }
};

/**
 * Run `fn` under the component lock with an explicit TTL.
 *
 * Returns false without running `fn` when the lock is held by somebody else. With the default
 * `maxRetryCount: 0` a contended lock is skipped immediately instead of burning the engine
 * default of 30 retries and throwing `LockError: Exceeded 30 attempts to lock the resource`
 * on every single tick while a receive() works through a backlog. Any other failure to take
 * the lock is re-thrown: reporting it as "somebody else is on it" would hide a broken lock
 * behind a component that silently never does any work.
 * @param {Object} context
 * @param {Object} [options]
 * @param {number} [options.maxRetryCount=0]
 * @param {string} [options.step] Log step used when the lock is contended.
 * @param {Function} fn async (lock) => void
 * @return {Promise<boolean>} whether `fn` ran
 */
const withComponentLock = async (context, { maxRetryCount = 0, step = 'lock-skipped' } = {}, fn) => {

    let lock = null;
    try {
        lock = await context.lock(context.componentId, { maxRetryCount, ttl: LOCK_TTL });
    } catch (err) {
        if (!isLockContentionError(err)) {
            throw err;
        }
        await context.log({ step, reason: err.message });
        return false;
    }

    try {
        await fn(lock);
    } finally {
        await safeUnlock(context, lock);
    }
    return true;
};

/**
 * Bounded memory of recently emitted item ids, kept in component state.
 *
 * A trigger's "created since" watermark is taken when a delta chain starts, so an item created
 * while the chain was being read is still newer than it on the next round - which keeps it from
 * being lost when Graph only reports it then. When Graph had already returned it in that chain
 * and reports it again (SharePoint post-processes uploads), this memory keeps it from being
 * emitted twice. It also dedupes a page that is replayed after a crash.
 * @param {Object} state Component state as loaded at the start of the scan.
 * @param {string} [key]
 * @return {{ has: function(string): boolean, add: function(string): void, persist: function(Object): Promise<void> }}
 */
const createEmittedIds = (state, key = EMITTED_IDS_KEY) => {

    const ids = Array.isArray(state[key]) ? state[key].slice(-MAX_EMITTED_IDS) : [];
    const known = new Set(ids);
    let dirty = false;

    return {
        has: (id) => known.has(id),
        add: (id) => {
            if (!id || known.has(id)) return;
            known.add(id);
            ids.push(id);
            dirty = true;
        },
        persist: async (context) => {
            if (!dirty) return;
            dirty = false;
            await context.stateSet(key, ids.slice(-MAX_EMITTED_IDS));
        }
    };
};

/**
 * Fetch a single Graph `delta` page.
 * @param {string} link Absolute `@odata.nextLink`/`@odata.deltaLink` or a Graph path.
 * @param {string} accessToken
 * @return {Promise<{ items: Array, nextLink: string|undefined, deltaLink: string|undefined }>}
 */
const fetchDeltaPage = async (link, accessToken) => {

    const page = await commons.formatError(() => {
        return commons.get(link, accessToken);
    });

    return {
        items: page.value || [],
        nextLink: page['@odata.nextLink'],
        deltaLink: page['@odata.deltaLink']
    };
};

/**
 * Walk a delta chain eagerly, collecting the items. Used only on paths that are NOT holding the
 * component lock (start() baselines and test()); the page cap keeps even those bounded.
 * @param {string} link
 * @param {string} accessToken
 * @param {Object} [options]
 * @param {number} [options.maxPages=MAX_PAGES_PER_RUN]
 * @return {Promise<{ items: Array, deltaLink: string|undefined }>}
 */
const fetchDeltaPages = async (link, accessToken, { maxPages = MAX_PAGES_PER_RUN } = {}) => {

    let items = [];
    let deltaLink;
    let pages = 0;

    while (link && pages < maxPages) {
        const page = await fetchDeltaPage(link, accessToken);
        items = items.concat(page.items);
        deltaLink = page.deltaLink;
        link = page.nextLink;
        pages += 1;
    }

    return { items, deltaLink };
};

/**
 * Establish a delta baseline without enumerating the drive. `?token=latest` makes Graph return
 * the current deltaLink straight away, so start() does not have to page through every file.
 * @param {string} deltaPath Graph delta path, e.g. `/drives/<id>/items/root/delta`.
 * @param {string} accessToken
 * @return {Promise<string>} the baseline deltaLink
 */
const fetchLatestDeltaLink = async (deltaPath, accessToken) => {

    const separator = deltaPath.includes('?') ? '&' : '?';
    const { deltaLink } = await fetchDeltaPage(`${deltaPath}${separator}token=latest`, accessToken);
    if (!deltaLink) {
        throw new Error('Microsoft Graph did not return a delta link for the watched location.');
    }
    return deltaLink;
};

/**
 * Process a Graph delta chain page by page under a bounded component lock.
 *
 * The whole point of driving the paging from here (instead of recursing until a deltaLink comes
 * back and only then emitting and saving) is that progress becomes durable after EVERY page:
 * a redelivered webhook notification or a crashed run resumes where it stopped rather than
 * replaying the whole backlog from the original deltaLink.
 *
 * `saveProgress` receives a `watermark` together with `caughtUp`: the moment the chain being
 * consumed was started, taken BEFORE its first page was fetched and carried across capped
 * continuations. A trigger that advances a "created since" cutoff once the chain is drained
 * must use it rather than the current time - anything created while the chain was being read
 * is then still newer than the cutoff on the next round instead of being silently dropped.
 *
 * Failures: a lost lock stops the run and leaves the rest to tick(). An expired delta link
 * (410) is replaced by a fresh baseline from `baseline()` - replaying the whole drive would be
 * worse than the gap, which is logged. Transient errors ask tick() to come back; anything else
 * is re-thrown without that, so a permanent error does not fail again every single minute.
 *
 * @param {Object} context
 * @param {Object} options
 * @param {Function} options.startLink async (state) => string|undefined - the link to resume from
 * @param {Function} options.onPage async (items, { state, extend }) => void - emits one page;
 *   `extend()` is cheap (re-arms the lock only when due) and is meant to be called after
 *   every emission
 * @param {Function} options.saveProgress async (link, { state, caughtUp, watermark }) => void
 * @param {Function} [options.baseline] async () => string - a fresh deltaLink (`?token=latest`)
 * @return {Promise<void>}
 */
const runDeltaScan = async (context, { startLink, onPage, saveProgress, baseline }) => {

    const { accessToken } = context.auth;

    const ran = await withComponentLock(context, { step: 'delta-scan-skipped' }, async (lock) => {

        const lease = { armedAt: Date.now() };
        const extend = () => extendLock(lock, lease);
        const extendIfStale = () => extendLockIfStale(lock, lease);
        const state = await context.loadState();

        // Cleared up front, never at the end: a run that gets skipped WHILE we are working
        // writes its own `true` here, and clearing afterwards would drop that notification.
        await context.stateSet(SKIPPED_FLAG, false);

        let chainStartedAt = state[CHAIN_STARTED_KEY];
        const watermark = chainStartedAt || new Date().toISOString();

        try {
            let link = await startLink(state);
            let pages = 0;

            while (link) {

                // Re-arm the lock before every call so a slow Graph response cannot let the
                // lock expire underneath us...
                await extend();

                const page = await fetchDeltaPage(link, accessToken);

                // ...and again right after it: the call itself may have used up most of the
                // TTL, and the page is about to be emitted.
                await extend();

                await onPage(page.items, { state, extend: extendIfStale });

                // Emitting may have taken a while. Never persist progress without the lock:
                // another run that took an expired lock over may already be further ahead.
                await extendIfStale();

                link = page.nextLink;
                const resumeLink = link || page.deltaLink;
                if (resumeLink) {
                    if (link && !chainStartedAt) {
                        // Stored BEFORE the mid-chain link, so a continuation can never find
                        // that link without the watermark of the chain it belongs to.
                        chainStartedAt = watermark;
                        await context.stateSet(CHAIN_STARTED_KEY, chainStartedAt);
                    }
                    await saveProgress(resumeLink, { state, caughtUp: !link, watermark });
                    if (!link && chainStartedAt) {
                        chainStartedAt = null;
                        await context.stateSet(CHAIN_STARTED_KEY, null);
                    }
                } else {
                    // Graph always returns one of the two links. Without either there is
                    // nothing to resume from, so the stored link still points at the page we
                    // just consumed and the next run would re-emit it. Say so out loud.
                    await context.log({ step: 'delta-no-resume-link', pages });
                }
                pages += 1;

                if (link && pages >= MAX_PAGES_PER_RUN) {
                    // Bounded work per invocation: release the lock and let tick() carry on
                    // instead of holding it for the (potentially unbounded) rest of the backlog.
                    await context.log({ step: 'delta-backlog-deferred', pages });
                    await context.stateSet(SKIPPED_FLAG, true);
                    return;
                }
            }
        } catch (err) {
            if (err instanceof LockLostError) {
                // Progress is durable, so simply stop here and let the next tick() pick it up.
                await context.log({ step: 'lock-lost', error: err.message });
                await context.stateSet(SKIPPED_FLAG, true);
                return;
            }
            if (isResyncRequired(err) && baseline) {
                await context.log({ step: 'delta-resync', error: err.message });
                const resyncedAt = new Date().toISOString();
                const fresh = await baseline();
                await saveProgress(fresh, { state, caughtUp: true, watermark: resyncedAt });
                if (chainStartedAt) {
                    await context.stateSet(CHAIN_STARTED_KEY, null);
                }
                return;
            }
            if (isTransientError(err)) {
                // Progress up to the last persisted page is durable, so make sure tick() comes
                // back for the rest. Without this, a failure in a tick()-driven continuation
                // would strand the backlog: there is no webhook redelivery to set the flag.
                await context.stateSet(SKIPPED_FLAG, true);
            }
            throw err;
        }
    });

    if (!ran) {
        // Somebody else is already working through the delta. Make sure tick() comes back for it.
        await context.stateSet(SKIPPED_FLAG, true);
    }
};

module.exports = {

    MAX_PAGES_PER_RUN,
    TEST_MODE_MAX_PAGES,
    LOCK_TTL,
    LOCK_REARM_AFTER,
    SKIPPED_FLAG,
    CHAIN_STARTED_KEY,
    EMITTED_IDS_KEY,
    MAX_EMITTED_IDS,
    LockLostError,
    isLockContentionError,
    isResyncRequired,
    isTransientError,
    extendLock,
    extendLockIfStale,
    safeUnlock,
    withComponentLock,
    createEmittedIds,
    fetchDeltaPage,
    fetchDeltaPages,
    fetchLatestDeltaLink,
    runDeltaScan
};
