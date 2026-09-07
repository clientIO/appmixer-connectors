'use strict';
const pathModule = require('path');
const crypto = require('crypto');

const XeroClient = require('./XeroClient');

// Default TTL for cached list/source calls. Kept short (2 min) because the same receive() also runs
// during normal flow execution, so 2 min staleness on list endpoints is an acceptable tradeoff.
const DEFAULT_LIST_CACHE_TTL = 2 * 60 * 1000;

// Lock settings for the withCache dedupe lock (key "xero:<hash>", i.e. the resource that surfaced as
// *META*::locks:xero:<hash> in the "Exceeded 30 attempts to lock the resource" failures on long jobs).
//
// - LOCK_TTL: the lock is a dead-man's switch. If the holder crashes (or is killed) mid-fetch the lock
//   must not linger forever, but it must comfortably outlive a full paginated fetch — a Xero list can be
//   ~100 sequential pages, each of which may sit through a Retry-After backoff on a 429, so a fetch can
//   legitimately take tens of seconds. 60s covers that with margin while still auto-recovering from a
//   stale lock left by a dead worker (dead-lock detection). It is < the default cache TTL (120s), so
//   under the default a lock never outlives the value it guards. (The cache TTL is configurable via
//   context.config.listCacheTTL; if it is set below 60s the lock may outlive the cached value, which
//   is harmless — a re-fetch simply re-populates the cache.)
// - LOCK_RETRY_DELAY / LOCK_MAX_RETRY_COUNT: how long a waiter blocks before giving up. 500ms * 60 = 30s,
//   which lets a waiter sit through a realistic fetch (including 429 backoff) instead of exhausting the
//   framework default (30 attempts) and throwing. Combined with the fallback below, exceeding even this
//   budget degrades gracefully rather than failing the component.
const LOCK_TTL = 60 * 1000;
const LOCK_RETRY_DELAY = 500;
const LOCK_MAX_RETRY_COUNT = 60;

function getCacheKey(obj) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify(obj))
        .digest('hex');
}

module.exports = {

    getCacheKey,

    /**
     * Cache the result of `fn` (typically the final, post-pagination records array) so that the burst
     * of live inspector source calls the designer fires when a Xero component is opened does not hammer
     * Xero's tight rate limits (60 calls/min, 5 concurrent per tenant) and trip 429s.
     *
     * - The cache key includes the caller's access token (user identity) plus the provided `keyParts`
     *   (tenant, endpoint, params), so entries are never shared across users/tenants/queries.
     * - `context.lock(key)` also deduplicates the concurrent burst: the first caller populates the
     *   cache while the rest wait on the lock and then read the freshly cached value.
     * - Caching a single assembled array saves up to ~100 upstream (paginated) calls, not just one.
     * - TTL is configurable via `context.config.listCacheTTL` (defaults to 120s, like ServiceNow).
     *
     * Falls back to a direct `fn()` call when lock/cache primitives are not available in the context.
     *
     * @param {object} context Component context.
     * @param {object} keyParts Parts that uniquely identify the request (e.g. { tenantId, url, params }).
     * @param {Function} fn Async function that performs the actual fetch and returns the records.
     * @returns {Promise<*>} The cached (or freshly fetched) result.
     */
    async withCache(context, keyParts, fn) {

        if (!context.lock || !context.staticCache) {
            return fn();
        }

        const token = context.auth?.accessToken || context.accessToken;
        const key = 'xero:' + getCacheKey({ ...keyParts, token });

        // Fast path: serve a warm cache without ever taking the lock. On long-running jobs the same
        // account/query is read over and over, so the overwhelming majority of calls hit this path and
        // never contend for the lock at all — this is what stops the *META* lock exhaustion. The lock is
        // only needed to dedupe the burst that populates a cold cache.
        const cachedBeforeLock = await context.staticCache.get(key);
        if (cachedBeforeLock !== null && cachedBeforeLock !== undefined) {
            return cachedBeforeLock;
        }

        // Cache miss: take the lock so a concurrent burst does not fire N duplicate paginated fetches
        // (Xero has tight rate limits). Acquisition is best-effort — never fail the component just
        // because the dedupe lock is contended/stale.
        let lock;
        try {
            lock = await context.lock(key, {
                ttl: LOCK_TTL,
                retryDelay: LOCK_RETRY_DELAY,
                maxRetryCount: LOCK_MAX_RETRY_COUNT
            });
        } catch (err) {
            // Lock exhausted (e.g. a very slow holder or a leftover stale lock). Degrade gracefully to
            // an un-deduplicated direct fetch: we lose only the burst dedupe, correctness is preserved,
            // and the job keeps running instead of dying with "Exceeded N attempts to lock the resource".
            await context.log({
                step: 'xero:withCache lock acquisition failed — falling back to direct fetch',
                key,
                error: err.message
            });
            return fn();
        }

        try {
            // Re-check under the lock: a waiter that just got the lock may find the previous holder
            // already populated the cache.
            const cached = await context.staticCache.get(key);
            if (cached !== null && cached !== undefined) {
                return cached;
            }

            const result = await fn();
            const ttl = context.config?.listCacheTTL || DEFAULT_LIST_CACHE_TTL;
            await context.staticCache.set(key, result, ttl);
            return result;
        } finally {
            // Always release the lock, in every path (cache hit, success, or fn() throwing). Awaited and
            // guarded so a release failure is logged rather than swallowed, and can never mask the
            // original result/error from the try block.
            try {
                await lock.unlock();
            } catch (err) {
                await context.log({ step: 'xero:withCache lock release failed', key, error: err.message });
            }
        }
    },

    // Expects standardized outputType: 'item', 'items', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'items', records = [] }) {
        if (outputType === 'item') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'items') {
            // All at once.
            await context.sendJson({ items: records }, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const headers = Object.keys(records[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'xero-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /**
     * Handles a webhook message from Xero plugin for contacts and invoices.
     * @param {string} endpoint The Xero endpoint to fetch data from. E.g. '/api.xro/2.0/Contacts'.
     * @returns {Promise<void>}
     */
    async webhookHandler(context, endpoint) {

        const { tenantId } = context.properties;
        await context.log({ step: 'Received webhook', tenantId, webhook: context.messages.webhook });

        let lock;
        try {
            lock = await context.lock(context.componentId, { maxRetryCount: 0 });

            const xc = new XeroClient(context, tenantId);
            const IDs = context.messages.webhook.content.data;
            // There might be hundreds of IDs in one webhook, so we need to fetch them in chunks of 40.
            // The limit here is the URL length, which is 2048 characters. This is a safe limit of 1440 characters.
            const chunkSize = 40;
            const chunks = [];
            for (let i = 0; i < IDs.length; i += chunkSize) {
                chunks.push(IDs.slice(i, i + chunkSize));
            }
            for (const chunk of chunks) {
                const chunkRecords = await xc.requestPaginated('GET', endpoint, { params: { IDs: chunk.join(','), includeArchived: true, summaryOnly: false } });

                // Send the data out. Await it so that we don't get ContextNotFoundError.
                await context.sendArray(chunkRecords, 'out');
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    },

    /**
     * Fetches the most recently updated record from a Xero endpoint to use as a
     * Flow Test Mode example. Goes through the SAME XeroClient as webhookHandler()
     * (same auth, endpoint, dataKey and includeArchived/summaryOnly flags) so the
     * emitted object is byte-for-byte identical to a real webhook delivery — only
     * the selection differs (newest-first instead of the webhook's IDs).
     * @param {string} endpoint The Xero endpoint, e.g. '/api.xro/2.0/Contacts'.
     * @returns {Promise<object>} The newest record.
     */
    async fetchLatestExample(context, endpoint) {

        const { tenantId } = context.properties;
        if (!tenantId) {
            throw new context.CancelError('Tenant is required to fetch a test example.');
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', endpoint, {
            countLimit: 1,
            params: { order: 'UpdatedDateUTC DESC', includeArchived: true, summaryOnly: false }
        });

        if (!records.length) {
            throw new context.CancelError(`No records found at ${endpoint} to use as test data.`);
        }

        return records[0];
    }
};
