'use strict';

const pathModule = require('path');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

const DEFAULT_PREFIX = 'requesty-objects-export';
const API_ORIGIN = 'https://router.requesty.ai';
const API_BASE_URL = `${API_ORIGIN}/v1`;

// See https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-input.
// Requesty proxies OpenAI-compatible embedding endpoints, so the same limits apply.
const MAX_INPUT_LENGTH = 8192 * 4; // max 8192 tokens, 1 token ~ 4 characters.
const MAX_BATCH_SIZE = 2048;

module.exports = {

    getBaseUrl() {
        return API_BASE_URL;
    },

    /**
     * Resolve a user-supplied endpoint against the Requesty origin. MakeApiCall attaches the
     * connector's API key to whatever URL it is given, so the origin has to be pinned: a full
     * URL pointing anywhere else would leak the credential to a third-party host.
     * @param {object} context
     * @param {string} url path (`/v1/models`) or absolute URL on the Requesty origin
     * @returns {string}
     */
    resolveApiUrl(context, url) {

        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
            ? url
            : `${url.startsWith('/') ? '' : '/'}${url}`;

        let parsed;
        try {
            parsed = new URL(candidate, API_ORIGIN);
        } catch (error) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }

        if (parsed.origin !== API_ORIGIN) {
            throw new context.CancelError(
                `API Endpoint Path must target ${API_ORIGIN}, got ${parsed.origin}.`
            );
        }

        return parsed.toString();
    },

    /**
     * Thin wrapper around context.httpRequest that applies the Requesty auth header.
     * context.httpRequest throws on non-2xx responses.
     * @param {object} context
     * @param {string} method
     * @param {string} path relative to the API base URL
     * @param {object} [data] request body
     * @returns {Promise<object>} the parsed response body
     */
    async request(context, method, path, data) {

        const options = {
            method,
            url: `${API_BASE_URL}${path}`,
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        };

        if (data !== undefined) {
            options.headers['content-type'] = 'application/json';
            options.data = data;
        }

        const response = await context.httpRequest(options);
        return response.data;
    },

    splitText(text, chunkSize, chunkOverlap) {

        const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
        return splitter.splitText(text);
    },

    /**
     * Embed a piece of text: split it into chunks, embed the chunks in batches and return them
     * in the shape shared by every Appmixer embedding component:
     * [{ index, text, vector }].
     * @param {object} context
     * @param {object} args
     * @param {string} args.text
     * @param {string} args.model
     * @param {number} args.chunkSize
     * @param {number} args.chunkOverlap
     * @returns {Promise<Array<{ index: number, text: string, vector: Array<number> }>>}
     */
    async generateEmbeddings(context, { text, model, chunkSize, chunkOverlap }) {

        const chunks = await this.splitText(text, chunkSize, chunkOverlap);
        await context.log({
            step: 'split-text',
            message: 'Text successfully split into chunks.',
            chunksLength: chunks.length,
            textLength: text.length
        });

        // The batch size is derived from the chunk size and the maximum input length so that a
        // batch cannot exceed the API limit. The maximum input length is halved to stay on the
        // safe side because the token-to-character ratio is only an estimate.
        const batchSize = Math.max(1, Math.min(Math.floor((MAX_INPUT_LENGTH / 2) / chunkSize), MAX_BATCH_SIZE));
        const embeddings = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            const response = await this.request(context, 'POST', '/embeddings', {
                model,
                input: batch,
                encoding_format: 'float'
            });

            (response.data || []).forEach((item, index) => {
                embeddings.push({
                    index: i + index,
                    text: batch[index],
                    vector: item.embedding
                });
            });
        }

        return embeddings;
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
            // Just the first one.
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getProperty(obj, path) {
        return path.split('.').reduce((acc, part) => acc?.[part], obj);
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title, ...schemaWithoutTitle } = schema;

                    res.push({
                        label: title, value: field, schema: schemaWithoutTitle
                    });
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
                label: label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: itemSchema
                    }
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
