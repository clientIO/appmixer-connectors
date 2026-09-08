'use strict';

const crypto = require('crypto');

const BASE_URL = 'https://api.mistral.ai/v1';

const getBaseUrl = () => BASE_URL;

const requestHeaders = (context, headers = {}) => ({
    accept: 'application/json',
    Authorization: `Bearer ${context.auth.apiKey}`,
    ...headers
});

// The CLI test runner provides no staticCache/lock (access throws) — treat the
// cache as best-effort so components still work there.
const cacheGet = async (context, key) => {
    try {
        return await context.staticCache.get(key);
    } catch (err) {
        return undefined;
    }
};

const cacheSet = async (context, key, value, ttl) => {
    try {
        await context.staticCache.set(key, value, ttl);
    } catch (err) {
        // Cache unavailable — nothing to do.
    }
};

const acquireLock = async (context, key) => {
    try {
        return await context.lock(key);
    } catch (err) {
        return null;
    }
};

/**
 * Cached GET for dynamic inspector source calls. The designer fires source calls
 * in concurrent bursts, so the first caller populates the cache under a lock and
 * the rest read the cached value.
 */
const apiCallCached = async (context, url) => {

    // The key covers the whole credential, not a suffix of it: two accounts whose
    // keys share the last characters would otherwise read each other's cached
    // response, and /audio/voices includes account-private custom voices.
    const key = 'ai-mistral-' + crypto.createHash('sha256')
        .update(JSON.stringify({ url, apiKey: context.auth.apiKey }))
        .digest('hex');
    let lock;
    try {
        lock = await acquireLock(context, key);
        const cached = await cacheGet(context, key);
        if (cached) {
            return cached;
        }
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${BASE_URL}${url}`,
            headers: requestHeaders(context)
        });
        const ttl = context.config.listCacheTTL || (120 * 1000);
        await cacheSet(context, key, data, ttl);
        return data;
    } finally {
        if (lock) {
            lock.unlock();
        }
    }
};

const sendArrayOutput = async ({ context, outputPortName = 'out', outputType = 'array', records = [] }) => {

    if (outputType === 'first') {
        if (records.length === 0) {
            throw new context.CancelError('No records available for first output type');
        }
        await context.sendJson({ ...records[0], index: 0, count: records.length }, outputPortName);
    } else if (outputType === 'object') {
        for (let index = 0; index < records.length; index++) {
            await context.sendJson({ ...records[index], index, count: records.length }, outputPortName);
        }
    } else if (outputType === 'array') {
        await context.sendJson({ result: records, count: records.length }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
};

const getOutputPortOptions = (context, outputType, itemSchema, { label }) => {

    if (outputType === 'object' || outputType === 'first') {
        const options = Object.keys(itemSchema).reduce((res, field) => {
            const schema = itemSchema[field];
            const { title, ...schemaWithoutTitle } = schema;
            res.push({ label: title, value: field, schema: schemaWithoutTitle });
            return res;
        }, [
            { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
        ]);
        return context.sendJson(options, 'out');
    }

    if (outputType === 'array') {
        return context.sendJson([
            { label: 'Items Count', value: 'count', schema: { type: 'integer' } },
            {
                label,
                value: 'result',
                schema: { type: 'array', items: { type: 'object', properties: itemSchema } }
            }
        ], 'out');
    }
};

module.exports = {
    getBaseUrl,
    requestHeaders,
    apiCallCached,
    sendArrayOutput,
    getOutputPortOptions
};
