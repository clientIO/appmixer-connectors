'use strict';

const commons = require('./microsoft-commons');

// Maximum number of Microsoft Graph `delta` pages processed by a single receive()/tick()
// invocation. Without a cap, a large delta backlog (a site with many files, a flow restarted
// after a long stop) keeps the component lock held for as long as Graph needs to page through
// it, which starves tick()/start() with LockError storms and livelocks on redelivery.
const MAX_PAGES_PER_RUN = 20;

// TTL the component lock is (re)armed with before every page and periodically while emitting.
// It has to comfortably cover one `delta` call including the HTTP timeout in
// microsoft-commons, otherwise the lock silently expires mid-run and a concurrent run can
// write state over it.
const LOCK_TTL = 60 * 1000;

// Re-arm the lock every N emitted items so a large page does not outlive the last extension.
const LOCK_EXTEND_EVERY_ITEMS = 20;

// Page cap for the read-only Flow Test Mode enumeration. test() walks the delta chain from the
// beginning (it deliberately has no baseline link to resume from), so it needs a lot more
// headroom than a single locked run - but it still has to be bounded, because it blocks an
// interactive request and holds no lock that would protect it.
const TEST_MODE_MAX_PAGES = 100;

// State flag telling tick() that there is more of the delta backlog to work through, either
// because this run hit MAX_PAGES_PER_RUN or because it could not get the component lock.
const SKIPPED_FLAG = 'hasSkippedMessage';

/**
 * Raised when the component lock could no longer be extended. Processing must stop rather than
 * continue unprotected - progress is durable, so the next tick() resumes where we left off.
 */
class LockLostError extends Error {}

/**
 * Re-arm the component lock. Throws LockLostError when the lock is already gone so that
 * callers abort instead of silently carrying on without mutual exclusion.
 * @param {Object} lock
 * @return {Promise<void>}
 */
const extendLock = async (lock) => {

    try {
        await lock.extend(LOCK_TTL);
    } catch (err) {
        throw new LockLostError(`Cannot extend the Microsoft component lock: ${err.message}`);
    }
};

/**
 * Release the lock without ever masking the error that is already propagating.
 * @param {Object} context
 * @param {Object} lock
 * @return {Promise<void>}
 */
const safeUnlock = async (context, lock) => {

    if (!lock) return;
    try {
        await lock.unlock();
    } catch (err) {
        await context.log({ step: 'unlock-failed', error: err.message });
    }
};

/**
 * Run `fn` under the component lock with an explicit TTL.
 *
 * Returns false without running `fn` when the lock could not be acquired. With the default
 * `maxRetryCount: 0` a contended lock is skipped immediately instead of burning the engine
 * default of 30 retries and throwing `LockError: Exceeded 30 attempts to lock the resource`
 * on every single tick while a receive() works through a backlog.
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
 * @param {Object} context
 * @param {Object} options
 * @param {Function} options.startLink async (state) => string|undefined - the link to resume from
 * @param {Function} options.onPage async (items, { state, extend }) => void - emits one page
 * @param {Function} options.saveProgress async (link, { state, caughtUp }) => void
 * @return {Promise<void>}
 */
const runDeltaScan = async (context, { startLink, onPage, saveProgress }) => {

    const { accessToken } = context.auth;

    const ran = await withComponentLock(context, { step: 'delta-scan-skipped' }, async (lock) => {

        const state = await context.loadState();
        const extend = () => extendLock(lock);

        // Cleared up front, never at the end: a run that gets skipped WHILE we are working
        // writes its own `true` here, and clearing afterwards would drop that notification.
        await context.stateSet(SKIPPED_FLAG, false);

        try {
            let link = await startLink(state);
            let pages = 0;

            while (link) {

                // Re-arm the lock before every call so a slow Graph response cannot let the
                // lock expire underneath us.
                await extend();

                const page = await fetchDeltaPage(link, accessToken);

                await onPage(page.items, { state, extend });

                link = page.nextLink;
                const resumeLink = link || page.deltaLink;
                if (resumeLink) {
                    await saveProgress(resumeLink, { state, caughtUp: !link });
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
            if (!(err instanceof LockLostError)) {
                throw err;
            }
            // Progress is durable, so simply stop here and let the next tick() pick it up.
            await context.log({ step: 'lock-lost', error: err.message });
            await context.stateSet(SKIPPED_FLAG, true);
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
    LOCK_EXTEND_EVERY_ITEMS,
    SKIPPED_FLAG,
    LockLostError,
    extendLock,
    safeUnlock,
    withComponentLock,
    fetchDeltaPage,
    fetchDeltaPages,
    fetchLatestDeltaLink,
    runDeltaScan
};
