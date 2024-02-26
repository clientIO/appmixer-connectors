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

    // TODO: Move to appmixer-lib
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
            const headers = Object.keys(records[0]);
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
