'use strict';
const request = require('request-promise');

/**
 * Create contact.
 */
module.exports = {

    async receive(context) {

        const apiUrl = context.profileInfo.apiUrl;
        const body = context.messages.contact.content;

        const id = body.id;
        const { status, data: [contact] = [] } = await request({
            method: 'PUT',
            url: apiUrl + 'contacts/' + id,
            body,
            headers: {
                'api-key': context.auth.apiKey
            },
            json: true
        });

        context.sendJson(contact, 'updatedContact');
    }
};
