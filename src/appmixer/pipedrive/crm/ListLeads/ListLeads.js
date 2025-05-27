'use strict';

/**
 * ListLeads action.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const options = {
            method: 'GET',
            url: 'https://api.pipedrive.com/v1/leads',
            headers: {
            'x-api-token': context.auth.apiKey
            }
        };

        const result = await context.httpRequest(options);


        if (!result?.data?.success) {
            throw new context.CancelError(result?.data?.error || 'Unknown API error');
        }

        return context.sendJson(result.data.data, 'out');
    }
};
