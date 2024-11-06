'use strict';
const pathModule = require('path');

module.exports = {

    /**
     *
     * @param context
     * @param outputPortName
     * @param {('array'|'file'|'object')} outputType
     * @param records
     * @returns {Promise<void>}
     */
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ array: records }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'hubspot-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    WATCHED_PROPERTIES_CONTACT: ['email', 'firstname', 'lastname', 'phone', 'website', 'company', 'address', 'city', 'state', 'zip'],
    WATCHED_PROPERTIES_DEAL: ['dealname', 'dealstage', 'pipeline', 'hubSpotOwnerId', 'closedate', 'amount']
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
                    property = JSON.stringify(property);
                    // Make stringified JSON valid CSV value.
                    property = property.replace(/"/g, '""');
                }
                return `"${property}"`;
            }).join(',');
        })

    ].join('\n');
};
