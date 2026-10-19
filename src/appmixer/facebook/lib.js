'use strict';

const pathModule = require('path');

const API_VERSION = 'v25.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const DEFAULT_PREFIX = 'facebook-objects-export';

/**
 * Facebook Graph API client using context.httpRequest.
 */
class FacebookClient {

    constructor(context) {
        this.context = context;
        this.accessToken = context.auth.accessToken;
    }

    async get(path, params = {}) {
        params.access_token = this.accessToken;
        const url = `${BASE_URL}${path}?` + new URLSearchParams(params).toString();
        const response = await this.context.httpRequest.get(url);
        return response.data;
    }

    async post(path, data = {}) {
        data.access_token = this.accessToken;
        const url = `${BASE_URL}${path}`;
        const response = await this.context.httpRequest.post(url, data);
        return response.data;
    }

    /**
     * POST multipart form data (a form-data instance), e.g. a file upload.
     */
    async postForm(path, form) {
        form.append('access_token', this.accessToken);
        const url = `${BASE_URL}${path}`;
        const response = await this.context.httpRequest.post(url, form, { headers: form.getHeaders() });
        return response.data;
    }

    /**
     * Set a different access token (e.g. page token).
     */
    setAccessToken(token) {
        this.accessToken = token;
        return this;
    }

    /**
     * Fetch all pages using cursor-based pagination.
     */
    async fetchAll(path, params = {}) {
        const results = [];
        let url = `${BASE_URL}${path}`;
        params.access_token = this.accessToken;

        let response = await this.context.httpRequest.get(url + '?' + new URLSearchParams(params).toString());
        let data = response.data;

        if (data.data) {
            results.push(...data.data);
        }

        while (data.paging?.next) {
            response = await this.context.httpRequest.get(data.paging.next);
            data = response.data;
            if (data.data) {
                results.push(...data.data);
            }
        }

        return results;
    }

    /**
     * Fetch pages using cursor-based pagination until `max` items are collected.
     * The Graph API serves at most 100 items per page.
     */
    async fetchUpTo(path, params = {}, max = 100) {
        const results = [];
        params.access_token = this.accessToken;
        params.limit = Math.min(100, max);

        let response = await this.context.httpRequest.get(`${BASE_URL}${path}?` + new URLSearchParams(params).toString());
        let data = response.data;
        results.push(...(data.data || []));

        while (results.length < max && data.paging?.next && data.data?.length) {
            response = await this.context.httpRequest.get(data.paging.next);
            data = response.data;
            results.push(...(data.data || []));
        }

        return results.slice(0, max);
    }
}

/**
 * Resolve the page access token + name and build a client scoped to the page.
 * Shared by NewPagePost and FindPagePosts so both issue the same authenticated requests.
 */
async function getPageClient(context, pageId) {

    const client = new FacebookClient(context);
    const pageDetails = await client.get(`/${pageId}`, { fields: 'access_token,name' });
    client.setAccessToken(pageDetails.access_token);
    return { client, pageDetails };
}

async function sendArrayOutput({
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

        const buffer = Buffer.from(csvString, 'utf8');
        const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
        const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
}

function getOutputPortOptions(context, outputType, itemSchema, { label }) {

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
}

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

module.exports = {
    FacebookClient,
    API_VERSION,
    BASE_URL,
    getPageClient,
    sendArrayOutput,
    getOutputPortOptions
};
