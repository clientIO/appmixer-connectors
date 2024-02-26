'use strict';
const request = require('request-promise');

/**
 * Create contact.
 */
module.exports = {

    async receive(context) {

        const apiUrl = context.profileInfo.apiUrl;
        const { id } = context.messages.in.content;
        const { status, data: [contact] = [] } = await request({
            method: 'GET',
            url: apiUrl + 'contacts/' + id,
            headers: {
                'api-key': context.auth.apiKey
            },
            json: true
        });

        context.sendJson(contact, 'contact');
    }
};
