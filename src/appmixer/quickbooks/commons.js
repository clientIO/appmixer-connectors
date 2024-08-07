'use strict';

const pathModule = require('path');

function getBaseUrl(context, auth) {

    const sandboxBaseURL = 'https://sandbox-accounts.platform.intuit.com';
    const sandboxApiURL = 'https://sandbox-quickbooks.api.intuit.com';
    const prodBaseURL = 'https://accounts.platform.intuit.com';
    const prodApiURL = 'https://quickbooks.api.intuit.com';

    const isSandbox = context.config.sandbox === true || context.config.sandbox === 'true'; // Ensure sandbox is correctly interpreted

    const baseUrl = isSandbox ?
        context.config.sandboxBaseURL || sandboxBaseURL :
        context.config.prodBaseURL || prodBaseURL;
    const apiUrl = isSandbox ?
        context.config.sandboxApiURL || sandboxApiURL :
        context.config.prodApiUrl || prodApiURL;

    return auth ? baseUrl : apiUrl;
}

// TODO: Move to appmixer-lib
function getCSVValue(value) {
    if (typeof value === 'object') {
        try {
            value = JSON.stringify(value);
            // Make stringified JSON valid CSV value.
            value = value.replace(/"/g, '""');
        } catch (e) {
            value = '';
        }
    }
    return `"${value}"`;
}

module.exports = {

    async makeRequest({ context, options }) {

        return context.httpRequest({
            url: options.url || `${getBaseUrl(context, false)}/${options.path}`,
            method: options.method,
            data: options.data,
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        }).catch(e => {
            if (e.response?.data) {
                if (Array.isArray(e.response.data)) {
                    const errorData = e.response.data[0];
                    throw errorData;
                }
                throw e.response.data;
            }
            throw e;
        });
    },

    async requestAccessToken(context) {

        const { clientId, clientSecret, authorizationCode } = context;
        const authorizationHeader = Buffer.from(
            `${clientId}:${clientSecret}`,
            'utf8'
        ).toString('base64');
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            Authorization: `Basic ${authorizationHeader}`
        };
        const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
        const requestBody = `grant_type=authorization_code&code=${authorizationCode}&redirect_uri=${context.callbackUrl}`;
        const { data: tokenResponse } = await context.httpRequest({
            url: tokenUrl,
            method: 'POST',
            data: requestBody,
            headers: headers
        });
        const expirationTime = new Date();
        expirationTime.setTime(
            expirationTime.getTime() + tokenResponse['expires_in'] * 1000
        );

        return {
            accessToken: tokenResponse['access_token'],
            refreshToken: tokenResponse['refresh_token'],
            accessTokenExpDate: expirationTime
        };
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
            const headers = Object.keys(records[0]);
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    return getCSVValue(record[header]);
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'quickbooks-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /**
     * Get latest changes for an entity and process it based on changeType
     * @see https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/change-data-capture
     * @param {*} context Context object
     * @param {string} entityName eg: 'Customer' or 'Invoice'
     * @param {string} changeType eg: 'new' or 'updated'
     */
    processEntityCDC: async function(context, entityName, changeType) {

        let lock;
        try {
            lock = await context.lock(context.componentId, { maxRetryCount: 0 });
            let { changedSince } = await context.stateGet('changedSince') || {};

            if (!changedSince) {
                // On first tick, fetch only the most recent update to set changedSince
                changedSince = new Date();
                await context.stateSet('changedSince', { changedSince });
            }

            const options = {
                path: `v3/company/${context.profileInfo.companyId}/cdc?entities=${entityName}&changedSince=${changedSince.toISOString()}`,
                method: 'GET'
            };

            try {
                const { data } = await module.exports.makeRequest({ context, options });

                if (!Array.isArray(data.CDCResponse) || !Array.isArray(data.CDCResponse[0].QueryResponse)) {
                    await context.log({ step: 'Invalid response from QuickBooks API', data });
                    throw new context.CancelError('Invalid response from QuickBooks API');
                }

                if (data.CDCResponse[0].QueryResponse[0][entityName]) {
                    for (const entity of data.CDCResponse[0].QueryResponse[0][entityName]) {
                        // Compare MetaData.CreateTime with MetaData.LastUpdatedTime to determine if the entity is new or updated
                        const isNew = entity?.MetaData?.CreateTime === entity?.MetaData?.LastUpdatedTime;
                        if (isNew && changeType === 'new') {
                            await context.sendJson(entity, 'out');
                        } else if (!isNew && changeType === 'updated') {
                            await context.sendJson(entity, 'out');
                        }
                    }
                }

                // Finally update changedSince to the latest time in the response
                changedSince = new Date(data.time);
                await context.stateSet('changedSince', { changedSince });
            } catch (error) {
                await context.log({ step: 'Error executing query', error });
                throw new context.CancelError('Error executing query: ' + error);
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    },

    /**
     * Handles a webhook message from QuickBooks plugin for contacts and invoices.
     * @param {string} entity The QuickBooks entity to fetch data from. E.g. 'Invoice'.
     * @returns {Promise<void>}
     */
    async webhookHandler(context, entity) {

        const realmId = context.profileInfo.companyId;
        await context.log({ step: 'Received webhook', entity, realmId, webhook: context.messages.webhook });

        let lock;
        try {
            lock = await context.lock(context.componentId, { maxRetryCount: 0 });

            const IDs = context.messages.webhook.content.data;
            // There might be hundreds of IDs in one webhook, so we need to fetch them in chunks of 40.
            // The limit here is the URL length, which is 2048 characters. This is a safe limit of 1440 characters.
            const chunkSize = 40;
            const chunks = [];
            for (let i = 0; i < IDs.length; i += chunkSize) {
                chunks.push(IDs.slice(i, i + chunkSize));
            }
            for (const chunk of chunks) {
                /** A query for filtering the results. */
                const query = `select * from ${entity} where Id in ('${chunk.join("','")}')`;
                const options = {
                    path: `v3/company/${context.profileInfo.companyId}/query?query=${encodeURIComponent(query)}`,
                    method: 'GET'
                };
                const chunkRecords = await module.exports.makeRequest({ context, options });
                // Send the data out. Await it so that we don't get ContextNotFoundError.
                await context.sendArray(chunkRecords?.data?.QueryResponse[entity], 'out');
            }
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    },

    getBaseUrl
};
