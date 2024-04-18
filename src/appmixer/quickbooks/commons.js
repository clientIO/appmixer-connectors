'use strict';

const pathModule = require('path');

function getBaseUrl(context, auth) {

    const sandboxBaseURL = 'https://sandbox-accounts.platform.intuit.com';
    const sandboxApiURL = 'https://sandbox-quickbooks.api.intuit.com';
    const prodBaseURL = 'https://accounts.platform.intuit.com';
    const prodApiURL = 'https://quickbooks.api.intuit.com';

    const baseUrl = context.config.sandbox ?
        context.config.sandboxBaseURL || sandboxBaseURL :
        context.config.prodBaseURL || prodBaseURL;
    const apiUrl = context.config.sandbox ?
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

    jsonata: require('jsonata'),

    jsonPointer: require('json-pointer'),

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

    getBaseUrl,

    async replaceRuntimeExpressions(template, context, response, request) {

        if (template === '$request.body') {
            return request.data;
        }

        let result = typeof template === 'string' ? template : JSON.stringify(template);

        result = result.replace(/{\$webhookUrl}/g, context.getWebhookUrl());
        result = result.replace(/{\$baseUrl}/g, this.getBaseUrl(context));

        result = result.replace(/{\$response.body#([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(response.data, pointer);
        });

        result = result.replace(/{\$parameters\.([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(context.properties, '/' + pointer);
        });

        result = result.replace(/{\$connection.profile\.([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(context.auth.profileInfo, '/' + pointer);
        });
        result = result.replace(/{\$connection.profile#([^}]*)}/g, (match, pointer) => {
            context.log({ step: 'replaceRuntimeExpressions - profile', pointer });
            context.log({ step: 'profileInfo', profileInfo: context.auth.profileInfo });
            context.log({ step: 'auth', auth: context.auth });
            return this.jsonPointer.get(context.auth.profileInfo, pointer);
        });

        const responseTransformPromises = [];
        const responseTransformRegex = /{\$response.transform#(.*(?<!\\))}/g;
        result.replace(responseTransformRegex, (match, exp) => {
            const expression = this.jsonata(exp);
            responseTransformPromises.push(expression.evaluate(response));
        });
        const replacements = await Promise.all(responseTransformPromises);
        result = result.replace(responseTransformRegex, () => replacements.shift());

        result = result.replace(/{\$response.header\.([^}]*)}/g, (match, pointer) => {
            return this.jsonPointer.get(response.headers, '/' + pointer);
        });

        return typeof template === 'string' ? result : JSON.parse(result);
    }
};
