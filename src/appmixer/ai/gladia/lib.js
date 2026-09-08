'use strict';

const pathModule = require('path');

const API_BASE_URL = 'https://api.gladia.io';
const DEFAULT_PREFIX = 'gladia-objects-export';

module.exports = {

    API_BASE_URL,

    /**
     * Resolve a user supplied endpoint (relative path or absolute URL) against the
     * Gladia API base and refuse anything that would send the account's API key
     * somewhere else.
     *
     * Resolving through the WHATWG URL parser and then comparing the resulting
     * origin also rejects protocol-relative input such as `//example.com/x`, which
     * would otherwise silently resolve to a foreign host.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string} url relative path (e.g. '/v2/transcription') or absolute Gladia URL
     * @returns {string} absolute URL on the Gladia API host
     */
    resolveApiUrl(context, url) {

        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
            ? url
            : `${url.startsWith('/') ? '' : '/'}${url}`;

        let parsed;
        try {
            parsed = new URL(candidate, API_BASE_URL);
        } catch (error) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }

        if (parsed.origin !== API_BASE_URL) {
            throw new context.CancelError(
                `API Endpoint Path must target ${API_BASE_URL}, got ${parsed.origin}.`
            );
        }

        return parsed.toString();
    },

    /**
     * Thin wrapper around context.httpRequest that applies the Gladia auth
     * header and returns the parsed response body. context.httpRequest throws
     * on non-2xx responses, so callers can rely on the body being present.
     * @param {object} args
     * @param {object} args.context Appmixer component context (needs `auth.apiKey`)
     * @param {string} [args.method] HTTP method (default GET)
     * @param {string} args.path API path starting with a slash (e.g. '/v2/transcription')
     * @param {object} [args.data] JSON request body
     * @param {object} [args.params] Query parameters
     * @returns {Promise<object>} the parsed response body
     */
    async makeRequest({ context, method = 'GET', path, data = null, params = null }) {

        const options = {
            method,
            url: API_BASE_URL + path,
            headers: {
                'x-gladia-key': context.auth.apiKey
            }
        };

        if (data) {
            options.data = data;
            options.headers['Content-Type'] = 'application/json';
        }
        if (params) {
            options.params = params;
        }

        const response = await context.httpRequest(options);
        return response ? response.data : null;
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

                    res.push({
                        label: fieldLabel, value: field, schema: schemaWithoutTitle
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
