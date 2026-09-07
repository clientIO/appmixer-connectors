'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'deepgram-objects-export';

const REGION_HOSTS = {
    global: 'https://api.deepgram.com',
    eu: 'https://api.eu.deepgram.com',
    au: 'https://api.au.deepgram.com'
};

const AUDIO_CONTENT_TYPES = {
    mp3: 'audio/mpeg',
    mpeg: 'audio/mpeg',
    m4a: 'audio/mp4',
    mp4: 'audio/mp4',
    aac: 'audio/aac',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    webm: 'audio/webm',
    amr: 'audio/amr'
};

module.exports = {

    /**
     * Resolve the API base URL from the auth object (or an auth-like context in validate).
     * Deepgram keys are portable across regions, so this only affects routing.
     * @param {object} auth - object holding region / customHost (context.auth or context)
     * @param {object} [context] - component context, used only to raise a CancelError
     * @returns {string}
     */
    getBaseUrl(auth = {}, context = null) {

        const region = auth.region || 'global';

        if (region === 'custom') {
            let host = (auth.customHost || '').trim().replace(/\/+$/, '');
            if (!host) {
                // Never silently fall back to the global endpoint - that would send the
                // credential and every request to a region the user did not select.
                const message = 'Region is set to "Custom / self-hosted" but Custom Host is empty. '
                    + 'Set the Custom Host on the connected Deepgram account or pick a built-in region.';
                throw context && context.CancelError ? new context.CancelError(message) : new Error(message);
            }
            if (!/^https?:\/\//i.test(host)) {
                host = `https://${host}`;
            }
            return host;
        }

        return REGION_HOSTS[region] || REGION_HOSTS.global;
    },

    /**
     * Build the Deepgram auth header. Note the `Token` scheme (NOT `Bearer`).
     * @param {object} auth - context.auth or context (in validate)
     * @returns {object}
     */
    getAuthHeaders(auth = {}) {
        return { Authorization: `Token ${auth.apiKey}` };
    },

    /**
     * Authorized Deepgram API request with base-URL resolution and error normalization.
     * @param {object} context
     * @param {object} options - { method, path, url, headers, data, params, responseType }
     * @returns {Promise<object>}
     */
    async apiRequest(context, { method = 'GET', path, url, headers = {}, data, params, responseType } = {}) {

        const auth = context.auth || context;
        const target = url || `${this.getBaseUrl(auth, context)}${path}`;

        try {
            return await context.httpRequest({
                method,
                url: target,
                headers: { ...this.getAuthHeaders(auth), ...headers },
                data,
                params,
                responseType
            });
        } catch (error) {
            throw this.normalizeError(context, error);
        }
    },

    /**
     * Translate a Deepgram HTTP error into a helpful CancelError. Deepgram uses two
     * different error envelopes and some endpoints return non-JSON bodies.
     * @param {object} context
     * @param {Error} error
     * @returns {Error}
     */
    normalizeError(context, error) {

        const response = error.response || {};
        const status = response.status;
        let body = response.data;

        // Binary endpoints (e.g. Text to Speech) may hand back a Buffer even on error.
        if (Buffer.isBuffer(body)) {
            try {
                body = JSON.parse(body.toString('utf8'));
            } catch (e) {
                body = body.toString('utf8');
            }
        } else if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) { /* keep as string */ }
        }

        let detail = '';
        if (body && typeof body === 'object') {
            // Envelope 1: { err_code, err_msg } ; Envelope 2: { category, message, details }
            detail = body.err_msg || body.message || body.reason || body.details || '';
        } else if (typeof body === 'string' && body) {
            detail = body;
        }

        // 413 means different things per endpoint: too much text for /v1/speak,
        // too large an audio upload everywhere else. Branch on the request path.
        const requestUrl = (error.config && error.config.url) || '';
        const payloadTooLarge = /\/v1\/speak(\?|$|\/)/.test(requestUrl)
            ? 'Payload too large (413). Text to Speech input exceeds the 2000-character limit.'
            : 'Payload too large (413). The request body exceeds the endpoint limit '
                + '(2000 characters for Text to Speech, 2 GB for audio uploads). '
                + 'Shorten the input, or pass audio by URL instead of uploading it.';

        const hints = {
            401: 'Authentication failed (401). Check that your API key is correct and uses the "Token" scheme.',
            402: 'Payment required (402). Your Deepgram project is out of credits. Top up your balance at https://console.deepgram.com.',
            413: payloadTooLarge,
            429: 'Too many requests (429). The project concurrency limit was exceeded. Retry with backoff or reduce parallel calls.',
            504: 'Gateway timeout (504). Processing exceeded the 10-minute ceiling (20 minutes for Whisper).'
        };

        const parts = [];
        parts.push(hints[status] || `Deepgram API request failed${status ? ` (${status})` : ''}.`);
        if (detail) {
            parts.push(detail);
        }

        const cancelError = new context.CancelError(parts.join(' '));
        cancelError.status = status;
        return cancelError;
    },

    /**
     * Guess an audio Content-Type from a filename extension. Deepgram sniffs the
     * container regardless, so octet-stream is a safe fallback.
     * @param {string} filename
     * @returns {string}
     */
    guessAudioContentType(filename = '') {
        const ext = (filename.split('.').pop() || '').toLowerCase();
        return AUDIO_CONTENT_TYPES[ext] || 'application/octet-stream';
    },

    /**
     * Drop null/undefined/empty-string values from a params object.
     * @param {object} params
     * @returns {object}
     */
    cleanParams(params = {}) {
        return Object.entries(params).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                acc[key] = value;
            }
            return acc;
        }, {});
    },

    /**
     * Diff a list of items against a known-id set (for polling triggers).
     * @param {Set|null} known
     * @param {Array} items
     * @param {string} idField
     * @returns {{ diff: Array, actual: Array }}
     */
    getNewItems(known, items = [], idField = 'request_id') {
        const diff = [];
        const actual = [];
        for (const item of items) {
            const id = item[idField];
            actual.push(id);
            if (known && !known.has(id)) {
                diff.push(item);
            }
        }
        return { diff, actual };
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
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log('info', 'File was saved', { fileName, fileId: savedFile.fileId });
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
                    const { title, ...schemaWithoutTitle } = schema;
                    res.push({ label: title, value: field, schema: schemaWithoutTitle });
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

/**
 * @param {array} array
 * @returns {string}
 */
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
