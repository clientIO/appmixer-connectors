'use strict';
const request = require('request-promise');

/**
 * List contacts.
 */
module.exports = {

    async receive(context) {

        const apiUrl = context.profileInfo.apiUrl;
        const { search } = context.messages.in.content;
        const { sendWholeArray } = context.properties;

        // build query string
        const qs = {};
        search && (qs.search = search);

        const contacts = await request({
            method: 'GET',
            url: apiUrl + 'contacts',
            qs,
            headers: {
                'api-key': context.auth.apiKey
            },
            json: true
        });

        if (sendWholeArray) {
            context.sendJson(contacts, 'contact');
        } else {
            contacts.data.forEach(c => context.sendJson(c, 'contact'));
        }
    },

    contactsToSelectArray(contacts) {

        if (contacts && Array.isArray(contacts.data)) {
            return contacts.data.map(c => ({ label: c.name, value: c.id }));
        }
        return [];
    }
};
