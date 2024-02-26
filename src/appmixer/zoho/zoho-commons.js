'use strict';
const pathModule = require('path');

module.exports = {

    /**
     * Builds a new object with new Keys using mapping.
     * @param {Object} input
     * @param {Object} inputToApiMapping
     * @returns {Object}
     */
    buildApiObject: (input, inputToApiMapping) => {

        return Object.entries(inputToApiMapping).reduce((result, [oldKey, newKey]) => {
            result[newKey] = input[oldKey];
            return result;
        }, {});
    },

    // TODO: Move to appmixer-lib
    // Expects standardized outputType: 'item', 'items', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'items', records = [] }) {
        if (outputType === 'item') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'items') {
            // All at once.
            await context.sendJson({ items: records }, outputPortName);
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
            const fileName = `${context.config.outputFilePrefix || 'zoho-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /** Handles filters with variants. */
    addFilterToParams(paramNames = [], params, context) {

        if (!Array.isArray(paramNames)) {
            return;
        }

        for (const paramName of paramNames) {

            const value = context.messages.in.content[paramName + '_value'];
            const variant = context.messages.in.content[paramName + '_variant'];

            if (value) {
                if (variant !== 'none' && variant) {
                    params[paramName + '_' + variant] = value;
                } else {
                    // 'none' or undefined means exact match.
                    params[paramName] = value;
                }
            }
        }
    }
};
