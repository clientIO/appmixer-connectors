'use strict';

const crypto = require('crypto');
const pathModule = require('path');
const { makeRequest } = require('./commons');

const DEFAULT_PREFIX = 'microsoft-teams-export';

module.exports = {

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
            // Only the first record.
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

    getProperty(obj, path) {
        return path.split('.').reduce((acc, part) => acc?.[part], obj);
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            return context.sendJson(Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: label, ...schemaWithoutTitle } = schema;

                    res.push({
                        label, value: field, schema: schemaWithoutTitle
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
                }]), 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label: label || 'Records',
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
    },

    /**
     * GET a Graph collection and follow `@odata.nextLink` until the last page.
     * @param {object} context
     * @param {string} path - path relative to the Graph v1.0 base URL, segments already encoded
     * @param {object} [params] - query parameters for the first page, e.g. `{ $top: 50 }`
     * @return {Promise<object[]>}
     */
    async listAll(context, path, params) {

        const records = [];
        let options = { method: 'GET', path, params };

        while (options) {
            const { data } = await makeRequest(context, options);
            records.push(...(data?.value || []));
            const nextLink = data?.['@odata.nextLink'];
            // The next link is an absolute URL that already carries the query parameters.
            options = nextLink ? { method: 'GET', url: nextLink } : null;
        }

        return records;
    },

    /**
     * The signed-in user. Needed wherever Graph wants the caller named explicitly,
     * e.g. in the member list of a chat being created.
     * @param {object} context
     * @return {Promise<object>}
     */
    async getMe(context) {

        const { data } = await makeRequest(context, { method: 'GET', path: '/me' });
        return data;
    },

    /**
     * The Graph path of a single message, in a channel or in a chat. Every segment is
     * encoded: channel and chat IDs look like `19:xxx@thread.tacv2`.
     * @param {object} target
     * @param {string} [target.location] - 'chat' or 'channel' (default)
     * @param {string} [target.parentMessageId] - set when the message is a channel reply
     * @return {string}
     */
    messagePath({ location, teamId, channelId, chatId, messageId, parentMessageId }) {

        const segment = encodeURIComponent;

        if (location === 'chat') {
            return `/chats/${segment(chatId)}/messages/${segment(messageId)}`;
        }

        const messages = `/teams/${segment(teamId)}/channels/${segment(channelId)}/messages`;
        return parentMessageId
            ? `${messages}/${segment(parentMessageId)}/replies/${segment(messageId)}`
            : `${messages}/${segment(messageId)}`;
    },

    /**
     * Cache the result of `fn` for dynamic inspector sources. The designer fires source
     * calls in concurrent bursts, so the lock makes the burst hit Graph only once.
     * @param {object} context
     * @param {string} key - identifies the call (endpoint and every input that shapes the result)
     * @param {function(): Promise<*>} fn
     * @return {Promise<*>}
     */
    async callCached(context, key, fn) {

        const cacheKey = 'microsoft-teams-' + crypto.createHash('sha256')
            .update(JSON.stringify({ key, token: context.auth?.accessToken }))
            .digest('hex');
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return cached;
            }

            const result = await fn();
            await context.staticCache.set(cacheKey, result, context.config.listCacheTTL || (2 * 60 * 1000));
            return result;
        } finally {
            lock?.unlock();
        }
    }
};

/**
 * Quote a CSV value when it contains a delimiter, quote or line break (RFC 4180).
 * @param {*} value
 * @returns {string}
 */
const toCsvValue = (value) => {

    if (value === null || value === undefined) {
        return '';
    }
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {

    if (!array || array.length === 0) {
        return '';
    }

    const headers = Object.keys(array[0]);

    return [
        headers.map(toCsvValue).join(','),
        ...array.map(item => headers.map(header => toCsvValue(item[header])).join(','))
    ].join('\n');
};
