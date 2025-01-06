'use strict';

/**
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        const token = context.auth.apiKey;
        const { siteId } = context.properties;

        const { data: forms } = await context.httpRequest({
            url: `https://api.webflow.com/v2/sites/${siteId}/forms`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'accept-version': '2.0.0'
            }
        });

        return context.sendJson(forms, 'out');
    }
};
