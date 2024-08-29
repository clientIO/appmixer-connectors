'use strict';
const GoogleApi = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const pathModule = require('path');

module.exports = {

    get GoogleApi() {

        return GoogleApi;
    },

    ERROR_MAP: {
        'Invalid query parameter value for grid_id.': 'Invalid worksheet id! '
            + 'Possible solution, stop the flow, select valid existing worksheet in NewRow component, start flow again.'
    },

    getOauth2Client(auth) {

        let { clientId, clientSecret, callback, accessToken } = auth;
        let OAuth2 = GoogleApi.auth.OAuth2;
        let oauth2Client = new OAuth2(clientId, clientSecret, callback);

        oauth2Client.credentials = {
            'access_token': accessToken
        };

        return oauth2Client;
    },

    /**
     * This returns the object used by the newest API SDK versions
     * @param auth
     * @returns {*}
     */
    getAuthLibraryOAuth2Client(auth) {

        const { clientId, clientSecret, callback, accessToken } = auth;

        const oAuth2Client = new OAuth2Client(clientId, clientSecret, callback);

        oAuth2Client.setCredentials({
            'access_token': accessToken
        });

        return oAuth2Client;
    },

    /**
     * Function compares two hexadecimal numbers (used as ID in gmail messages), this
     * function can be used for Array.prototype.sort() method.
     * Use Array.prototype.sort(commons.compareIds(a, b)) for ASC and
     * Array.prototype.sort(commons.compareIds(a, b)) for DESC.
     * @param {string} a - hexadecimal number
     * @param {string} b - hexadecimal number
     * @returns {number} - returns -1 if a < b, 1, if a > b and 0 if numbers are equal
     */
    compareIds(a, b) {

        let ax = parseInt(a, 16);
        if (isNaN(ax)) {
            throw new Error('First value: ' + a + ' is not a hexadecimal number');
        }

        let bx = parseInt(b, 16);
        if (isNaN(bx)) {
            throw new Error('Second value ' + b + ' is not a hexadecimal number');
        }

        if (ax < bx) {
            return -1;
        }
        if (ax > bx) {
            return 1;
        }

        return 0;
    },

    /**
     * Convert google's date|dateTime object into Date.
     * @param {Object} dateObject - containing either date or dateTime
     * @return {Date|*}
     */
    formatDate(dateObject) {

        if (!dateObject) {
            return dateObject;
        }
        return new Date(dateObject.date ? dateObject.date : dateObject.dateTime);
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
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'google-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }
};

// TODO: Move to appmixer-lib
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
