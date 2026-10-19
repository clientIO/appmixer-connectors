'use strict';

const crypto = require('crypto');

const API_BASE_URL = 'https://api.linkedin.com';
// Versions are supported for about a year: https://learn.microsoft.com/en-us/linkedin/marketing/versioning
const VERSION_HEADER = '202608';

function getCacheKey(obj) {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

module.exports = {

    API_BASE_URL,
    VERSION_HEADER,

    /**
     * Headers required by the versioned LinkedIn REST API.
     * @param {Context} context
     * @returns {Object}
     */
    getHeaders(context) {

        return {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'LinkedIn-Version': VERSION_HEADER,
            'X-Restli-Protocol-Version': '2.0.0'
        };
    },

    /**
     * Run `fn` once per cache key and keep its result for a while. Used by
     * components that back inspector dropdowns - the designer fires those calls
     * in bursts every time an inspector opens.
     * @param {Context} context
     * @param {Object} keyParts Everything that shapes the result (the token is added automatically).
     * @param {Function} fn Async function producing the value to cache.
     * @param {number} [ttl] Cache TTL in ms. Defaults to `listCacheTTL` from the service config, then 2 minutes.
     * @returns {Promise<*>}
     */
    async withCache(context, keyParts, fn, ttl) {

        let lock;
        try {
            const key = getCacheKey({ ...keyParts, token: context.auth.accessToken });
            // The first caller may need several requests; let the rest of the burst wait up to 30 s.
            lock = await context.lock(key, { ttl: 60 * 1000, retryDelay: 500, maxRetryCount: 60 });

            const cached = await context.staticCache.get(key);
            if (cached) {
                return cached;
            }

            const value = await fn();
            await context.staticCache.set(key, value, ttl || context.config.listCacheTTL || 2 * 60 * 1000);
            return value;
        } finally {
            lock?.unlock();
        }
    },

    /**
     * Resolve a MakeApiCall path against the LinkedIn API and refuse any other origin,
     * so the account's token is never sent to a third-party host.
     * @param {Context} context
     * @param {string} url Path such as `/rest/posts` or a full `https://api.linkedin.com/...` URL.
     * @returns {string}
     */
    resolveApiUrl(context, url) {

        url = String(url);
        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
            ? url
            : `${url.startsWith('/') ? '' : '/'}${url}`;

        let parsed;
        try {
            parsed = new URL(candidate, API_BASE_URL);
        } catch (err) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }
        if (parsed.origin !== API_BASE_URL) {
            throw new context.CancelError(`API Endpoint Path must target ${API_BASE_URL}, got ${parsed.origin}.`);
        }

        return parsed.toString();
    },

    /**
     * Escape text for LinkedIn's "little text" format used by the post commentary. Unescaped
     * reserved characters cut the post short or make LinkedIn reject it
     * (https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format).
     * `#` stays as typed so hashtags keep working.
     * @param {string} text
     * @returns {string}
     */
    escapeLittleText(text) {

        return String(text).replace(/[\\|{}@[\]()<>*_~]/g, char => `\\${char}`);
    },

    /**
     * Convert a key-value inspector value to a plain object. The designer stores it as
     * an array of `{ key, value }` rows, flows may pass the same array as a JSON string.
     * @param {Context} context
     * @param {Array|string|Object} value
     * @param {string} label Input label used in the error message.
     * @returns {Object}
     */
    keyValueToObject(context, value, label) {

        let rows = value;
        if (typeof rows === 'string') {
            if (!rows.trim()) {
                return {};
            }
            try {
                rows = JSON.parse(rows);
            } catch (err) {
                throw new context.CancelError(`${label} must be a list of key-value pairs.`);
            }
        }
        if (!rows) {
            return {};
        }
        if (!Array.isArray(rows)) {
            return typeof rows === 'object' ? { ...rows } : {};
        }

        const result = {};
        for (const row of rows) {
            if (row && typeof row.key === 'string' && row.key.length > 0) {
                result[row.key] = row.value;
            }
        }
        return result;
    }
};
