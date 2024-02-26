'use strict';
const request = require('request-promise');

/**
 * Create contact.
 */
module.exports = {

    async receive(context) {

        const apiUrl = context.profileInfo.apiUrl;
        const qs = context.messages.contact.content;
        const { status } = await request({
            method: 'DELETE',
            url: apiUrl + 'contacts',
            qs,
            headers: {
                'api-key': context.auth.apiKey
            },
            json: true
        });

        context.sendJson({ status }, 'deletedContact');
    }
};
