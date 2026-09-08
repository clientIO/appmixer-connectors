'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'assemblyai-objects-export';

const BASE_URLS = {
    us: 'https://api.assemblyai.com',
    eu: 'https://api.eu.assemblyai.com'
};

// Trigger polling: one page is 50 records, and up to MAX_PAGES pages are walked per tick
// so a burst between ticks cannot be missed. MAX_SEEN caps the ids carried in the state.
const TRIGGER_PAGE_LIMIT = 50;
const TRIGGER_MAX_PAGES = 20;
const MAX_SEEN = 1000;

module.exports = {

    /**
     * Region-aware base URL for the core Speech-to-Text API. The region is an
     * auth-level field because AssemblyAI keys are not portable across regions.
     * @param {object} context
     * @returns {string}
     */
    getBaseUrl(context) {
        const region = context.auth && context.auth.region;
        return BASE_URLS[region] || BASE_URLS.us;
    },

    /**
     * AssemblyAI expects the raw API key in the Authorization header WITHOUT a
     * "Bearer " prefix.
     * @param {object} context
     * @returns {object}
     */
    getHeaders(context) {
        return {
            Authorization: context.auth.apiKey
        };
    },

    /**
     * Walk the transcript list (newest first) until a record the trigger has already
     * emitted is reached, so more than one page of new records between two ticks is
     * still picked up. Stops after TRIGGER_MAX_PAGES pages as a safety cap.
     * @param {object} context
     * @param {object} options - { status, seen } where seen is a Set of known ids or null
     * @returns {Promise<{ records: array, truncated: boolean }>} records are oldest first
     */
    async fetchTranscriptsUntilSeen(context, { status, seen } = {}) {

        const baseUrl = this.getBaseUrl(context);
        const headers = this.getHeaders(context);

        const params = { limit: TRIGGER_PAGE_LIMIT };
        if (status) {
            params.status = status;
        }

        let url = `${baseUrl}/v2/transcript`;
        // The first request is parameterized; next_url already carries limit and status.
        let requestParams = params;
        const records = [];
        let pages = 0;
        let reachedKnown = false;

        while (url && pages < TRIGGER_MAX_PAGES) {

            const { data } = await context.httpRequest({ method: 'GET', url, headers, params: requestParams });
            const transcripts = (data && data.transcripts) || [];

            for (const transcript of transcripts) {
                if (seen && seen.has(transcript.id)) {
                    reachedKnown = true;
                    break;
                }
                records.push(transcript);
            }

            pages += 1;

            if (reachedKnown || transcripts.length === 0) {
                break;
            }

            const nextUrl = data && data.page_details && data.page_details.next_url;
            if (!nextUrl) {
                break;
            }

            url = nextUrl.startsWith('http') ? nextUrl : `${baseUrl}${nextUrl}`;
            requestParams = undefined;
        }

        // Emit oldest first so downstream components see the records in the order they happened.
        return { records: records.reverse(), truncated: !reachedKnown && pages >= TRIGGER_MAX_PAGES };
    },

    /**
     * Ids to persist after a tick: everything just scanned plus the previous window,
     * newest first and capped so the state cannot grow without bound.
     * @param {array} newIds - ids seen in this tick, oldest first
     * @param {array} previousIds
     * @returns {array}
     */
    mergeSeenIds(newIds, previousIds) {

        const merged = [...[...newIds].reverse(), ...(previousIds || [])];
        return [...new Set(merged)].slice(0, MAX_SEEN);
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
