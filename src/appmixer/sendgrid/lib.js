'use strict';

const pathModule = require('path');

const BASE_URL = 'https://api.sendgrid.com/v3';
const DEFAULT_PREFIX = 'sendgrid';

const toCsv = (array) => {
    if (!array || array.length === 0) {
        return '';
    }
    const headers = Object.keys(array[0]);

    return [
        headers.join(','),
        ...array.map(item => {
            return Object.values(item).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
};

module.exports = {

    async apiRequest(context, endpoint, options = {}) {

        const { method = 'GET', data, params } = options;

        const requestOptions = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`,
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            requestOptions.data = data;
        }

        if (params) {
            requestOptions.params = params;
        }

        const response = await context.httpRequest(requestOptions);
        return response.data;
    },

    async paginatedApiRequest(context, endpoint, propertyName, options = {}) {

        const { method = 'GET', data, params = {} } = options;
        const allResults = [];

        let pageToken = null;

        do {
            const requestParams = { ...params };
            if (pageToken) {
                requestParams.page_token = pageToken;
            }

            const response = await this.apiRequest(context, endpoint, {
                method,
                data,
                params: requestParams
            });

            if (response[propertyName]) {
                allResults.push(...response[propertyName]);
            }

            // eslint-disable-next-line no-underscore-dangle
            const metadata = response._metadata;
            pageToken = metadata?.next ? new URL(metadata.next).searchParams.get('page_token') : null;
        } while (pageToken);

        return allResults;
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

    getOutputPortOptions(context, outputType, schema, { label }) {

        if (outputType === 'first' || outputType === 'object') {
            return Object.keys(schema)
                .reduce((res, field) => {
                    const fieldSchema = schema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = fieldSchema;
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
        }

        if (outputType === 'array') {
            return [{
                label: label || 'Records',
                value: 'result',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: schema }
                }
            }];
        }

        if (outputType === 'file') {
            return [{ label: 'File ID', value: 'fileId' }];
        }
    }
};
