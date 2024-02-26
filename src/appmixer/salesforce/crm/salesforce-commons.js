const SalesforceAPI = require('jsforce');
const pathModule = require('path');
const DEFAULT_API_VERSION = '58.0';

module.exports = {

    // TODO: Move to appmixer-lib
    // Expects standardized outputType: 'object', 'array', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'salesforce-objects-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /**
     * Get new SalesforceAPI
     * @param context - Appmixer context object.
     * @returns {*}
     */
    getSalesforceAPI(context) {

        const instanceUrl = context.profileInfo.instanceUrl;
        const accessToken = context.auth.accessToken;
        const version = context.config.apiVersion || DEFAULT_API_VERSION;

        return new SalesforceAPI.Connection({
            instanceUrl,
            accessToken,
            version
        });
    },

    Date: SalesforceAPI.Date,

    /**
     * Salesforce has a weird datetime format '2017-04-28T16:18:47.000+0000', but AJV
     * schema validator does not buy that, so let's reformat to ISO.
     * @param {string} date
     * @return {string}
     */
    formatDate(date) {

        if (!date) {
            return date;
        }
        return new Date(date).toISOString();
    },

    /**
     * Go through certain record fields and apply format function.
     * @param {Object} record - salesforce record - contact, ...
     * @param {Array} fields - array with field names to be formatted
     * @param {function} formatFunc
     * @return {Object} record
     */
    formatFields(record, fields, formatFunc) {

        fields.forEach(field => {
            record[field] = formatFunc(record[field]);
        });
        return record;
    },

    // API
    api: {
        async getObjectFields(context, { objectName }) {
            const { data } = await this.salesForceRq(context, {
                action: `sobjects/${objectName}/describe`
            });
            return data?.fields || [];
        },

        async createObject(context, { objectName, json }) {
            const { data } = await this.salesForceRq(context, {
                method: 'POST',
                action: `sobjects/${objectName}`,
                data: JSON.stringify(json),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return data;
        },

        async salesForceRq(context, { method = 'GET', headers = {}, data, action }) {

            const version = `v${context.config.apiVersion || DEFAULT_API_VERSION}`;

            return await context.httpRequest({
                method,
                url: `${context.profileInfo.instanceUrl}/services/data/${version}/${action}`,
                data,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    ...headers
                }
            });
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
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })

    ].join('\n');
};
