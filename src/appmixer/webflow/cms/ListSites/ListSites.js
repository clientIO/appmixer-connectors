'use strict';

/**
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const token = context.auth.apiKey;

        const { data: sites } = await context.httpRequest({
            url: 'https://api.webflow.com/v2/sites',
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'accept-version': '2.0.0',
            }
        });

        return context.sendJson(sites, 'out');
    }
};
