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
    WATCHED_PROPERTIES_DEAL: ['dealname', 'dealstage', 'pipeline', 'hubSpotOwnerId', 'closedate', 'amount'],

    async getObjectProperties(context, hubspot, objectType, output = 'all') {

        // Default cache TTL set to 1 minute as property definitions rarely change
        // Can be configured via context.config.objectPropertiesCacheTTL if needed
        const objectPropertiesCacheTTL = context.config.objectPropertiesCacheTTL || (60 * 1000);
        // Use hub_id from context to differentiate between different HubSpot portals/users.
        const portalId = context.auth?.profileInfo?.hub_id;
        const cacheKeyPrefix = 'hubspot_properties_' + objectType + '_' + portalId;
        let lock;
        try {
            lock = await context.lock(`hubspot_properties_${objectType}`);
            const cached = await context.staticCache.get(cacheKeyPrefix + '_' + output);
            if (cached) {
                return cached;
            }

            // Get all properties from HubSpot.
            const { data } = await hubspot.call('get', `crm/v3/properties/${objectType}`);
            // Custom fields should have `[custom]` in the label
            data.results.forEach(property => {
                if (property.createdUserId) {
                    property.label = `${property.label} [custom]`;
                }
            });
            const properties = data.results.map(property => property.name);

            // Save to cache both versions: triggers and actions.
            await context.staticCache.set(cacheKeyPrefix + '_all', data.results, objectPropertiesCacheTTL);
            await context.staticCache.set(cacheKeyPrefix + '_names', properties, objectPropertiesCacheTTL);

            // For triggers return array of names: ['email', 'firstname', ...]
            if (output === 'names') {
                return properties;
            }

            // For actions return array of objects: [{ name: 'email', type: 'string', ... }, ...]
            return data.results;
        } finally {
            await lock?.unlock();
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
                    property = JSON.stringify(property);
                    // Make stringified JSON valid CSV value.
                    property = property.replace(/"/g, '""');
                }
                return `"${property}"`;
            }).join(',');
        })

    ].join('\n');
};
