'use strict';
const baseUrl = 'https://graph.microsoft.com/v1.0';
module.exports = {

    async makeRequest(context, options) {

        return await context.httpRequest({
            url: options.url || `${baseUrl}${options.path}`,
            method: options.method,
            data: options.data,
            params: options.params,
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        });
    }
};
