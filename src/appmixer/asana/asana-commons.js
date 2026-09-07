'use strict';
const AsanaAPI = require('asana');
const pathModule = require('path');

module.exports = {

    /**
     * Get new AsanaAPI
     * @param {string} token
     * @returns {*}
     */
    getAsanaAPI(token) {

        return new AsanaAPI.Client.create().useAccessToken(token);
    },

    /**
     * Pick the most recently created record from a listing. Asana `gid`s are monotonically
     * increasing, so the highest `gid` is the newest record; `created_at` is preferred when
     * present. Shared by the triggers' `test()` methods to select the freshest item to emit
     * as Flow Test Mode example data.
     * @param {Array<Object>} records
     * @returns {Object|null}
     */
    pickLatest(records = []) {

        const rank = record => (record.created_at ? Date.parse(record.created_at) : Number(record.gid));
        return (records || []).reduce((latest, record) => {
            if (!latest) {
                return record;
            }
            return rank(record) > rank(latest) ? record : latest;
        }, null);
    },

    // Expects standardized outputType: 'item', 'items', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'items', records = [] }) {
        if (outputType === 'item') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'items') {
            // All at once.
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
            const fileName = `${context.config.outputFilePrefix || 'asana-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }
};
