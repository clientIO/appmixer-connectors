'use strict';
const request = require('request-promise');

/**
 * Create contact.
 */
module.exports = {

    async receive(context) {

        const apiUrl = context.profileInfo.apiUrl;
        const body = context.messages.contact.content;

        const { data: [contact] = [] } = await request({
            method: 'POST',
            url: apiUrl + 'contacts',
            body,
            headers: {
                'api-key': context.auth.apiKey
            },
            json: true
        });

        context.sendJson(contact, 'newContact');
    }
};
