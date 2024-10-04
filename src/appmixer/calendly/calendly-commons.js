'use strict';
const request = require('request-promise');

module.exports = {

    /**
     * Get request for calendly.
     * @param {string} token
     * @param {string} event - should be one of ['invitee.created', 'invitee.canceled']
     * @param {string} url - webhook callback url that will be registered
     * @returns {*}
     */
    registerWebhookSubscription(token, event, url) {

        return request({
            method: 'POST',
            url: 'https://calendly.com/api/v1/hooks',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            json: true,
            body: {
                url: url,
                events: [event]
            }
        });
    },

    /**
     * DELETE request for calendly to remove webhook subscription.
     * @param {string} webhookId
     * @param {string} token
     * @returns {*}
     */
    removeWebhookSubscription(webhookId, token) {

        return request({
            method: 'DELETE',
            url: `https://calendly.com/api/v1/hooks/${webhookId}`,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    }
};
