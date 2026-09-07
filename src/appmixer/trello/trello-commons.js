'use strict';

const pathModule = require('path');

module.exports = {

    getAuthQueryParams(context) {

        return new URLSearchParams({
            key: context.auth.consumerKey,
            token: context.auth.accessToken
        });
    },

    // Shared GET against the Trello REST API: builds the authenticated URL the same
    // way for every trigger and returns the response body (an array). Used by both
    // tick() and test() so they issue byte-for-byte identical requests.
    async fetchAll(context, urlPath) {

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com${urlPath}?${this.getAuthQueryParams(context)}`
        });
        return data;
    },

    // Trello ids are Mongo ObjectIds whose first 8 hex chars are the creation
    // timestamp, so the record with the greatest timestamp is the newest. Used by
    // test() to pick the freshest item to emit as Flow Test Mode example data.
    pickLatestById(records = []) {

        const timestamp = record => parseInt(String(record.id).substring(0, 8), 16) || 0;
        return (records || []).reduce((latest, record) => {
            if (!latest) {
                return record;
            }
            return timestamp(record) > timestamp(latest) ? record : latest;
        }, null);
    },

    isAppmixerVariable(variable) {

        return variable?.startsWith('{{{') && variable?.endsWith('}}}');
    },

    // Expects standardized outputType: 'item', 'items', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'items', records = [] }) {

        if (outputType === 'item' || outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'items' || outputType === 'array') {
            // All at once. Handling both 'items' and 'array' as 'items'.
            if (outputType === 'array') {
                return await context.sendJson({ array: records }, outputPortName);
            }
            await context.sendJson(records, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const headers = Object.keys(records[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'trello-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }
};
