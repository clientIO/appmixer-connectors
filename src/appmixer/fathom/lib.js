'use strict';

const pathModule = require('path');
const crypto = require('crypto');

const API_BASE_URL = 'https://api.fathom.ai/external/v1';
const DEFAULT_PREFIX = 'fathom-objects-export';

// Safety caps for cursor pagination. Fathom's global rate limit is 60 requests / 60s
// (heavy endpoints as low as 5/60s), so List/Find components must not loop unbounded.
const DEFAULT_MAX_ITEMS = 500;
const DEFAULT_MAX_PAGES = 50;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {

    API_BASE_URL,

    // Authentication header used by every request. Fathom keys are passed as `X-Api-Key`.
    getHeaders(context) {
        return {
            'X-Api-Key': context.auth.apiKey
        };
    },

    /**
     * 429-aware wrapper around context.httpRequest. Fathom returns `Retry-After` (seconds)
     * on 429; we honour it and otherwise fall back to capped exponential backoff.
     */
    async apiRequest(context, options, { maxRetries = 3 } = {}) {

        let attempt = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                return await context.httpRequest(options);
            } catch (err) {
                const status = err.response && err.response.status;
                if (status === 429 && attempt < maxRetries) {
                    const headers = (err.response && err.response.headers) || {};
                    const retryAfter = parseInt(headers['retry-after'], 10);
                    const waitMs = Number.isFinite(retryAfter)
                        ? retryAfter * 1000
                        : Math.min(1000 * Math.pow(2, attempt), 15000);
                    await context.log({ step: 'rate-limited', status, attempt, waitMs });
                    await sleep(waitMs);
                    attempt += 1;
                    continue;
                }
                throw err;
            }
        }
    },

    /**
     * Follow Fathom's cursor pagination ({ limit, next_cursor, items[] }) up to a safe cap.
     */
    async fetchAllPages(context, {
        url,
        params = {},
        headers,
        maxItems = DEFAULT_MAX_ITEMS,
        maxPages = DEFAULT_MAX_PAGES
    } = {}) {

        const items = [];
        let cursor;
        let pages = 0;

        do {
            const query = { ...params };
            if (cursor) {
                query.cursor = cursor;
            }

            const { data } = await this.apiRequest(context, { method: 'GET', url, headers, params: query });
            const pageItems = (data && data.items) || [];
            items.push(...pageItems);

            cursor = data && data.next_cursor;
            pages += 1;
        } while (cursor && items.length < maxItems && pages < maxPages);

        return items.slice(0, maxItems);
    },

    /**
     * Verify a Fathom (Svix-style) webhook signature. Best-effort helper — returns true/false.
     * secret: the `whsec_...` value returned when the webhook was created.
     * headers: object containing `webhook-id`, `webhook-timestamp`, `webhook-signature`.
     * rawBody: the exact raw request body string.
     */
    verifyWebhookSignature(secret, headers = {}, rawBody = '') {

        const id = headers['webhook-id'];
        const timestamp = headers['webhook-timestamp'];
        const signatureHeader = headers['webhook-signature'];
        if (!secret || !id || !timestamp || !signatureHeader) {
            return false;
        }

        const ts = parseInt(timestamp, 10);
        const now = Math.floor(Date.now() / 1000);
        if (!Number.isFinite(ts) || Math.abs(now - ts) > 60 * 5) {
            return false;
        }

        const secretBytes = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
        const signedContent = `${id}.${timestamp}.${rawBody}`;
        const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

        // `webhook-signature` is a space-separated list of version-prefixed signatures, e.g. "v1,<base64>".
        const passedSigs = String(signatureHeader).split(' ').map(part => (part.includes(',') ? part.split(',')[1] : part));

        return passedSigs.some(sig => {
            try {
                const a = Buffer.from(sig);
                const b = Buffer.from(expected);
                return a.length === b.length && crypto.timingSafeEqual(a, b);
            } catch (e) {
                return false;
            }
        });
    },

    async sendArrayOutput({
        context,
        outputPortName = 'out',
        outputType = 'array',
        records = []
    }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            const csvString = toCsv(records);
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = schema;
                    res.push({ label: fieldLabel, value: field, schema: schemaWithoutTitle });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);
            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: itemSchema }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

const toCsv = (array) => {

    if (!array.length) {
        return '';
    }

    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
};
