'use strict';
const request = require('request-promise');

module.exports = {

    async receive(context) {

        const { auth } = context;
        let contacts;

        try {
            contacts = await request({
                method: 'GET',
                url: `https://${auth.domain}.freshdesk.com/api/v2/contacts`,
                auth: {
                    user: auth.apiKey,
                    password: 'X'
                },
                json: true
            });
        } catch (e) {
            const body = e.response.body;
            if (body.code === 'access_denied') {
                contacts = [];
            } else {
                throw e;
            }
        }
        return context.sendJson({ contacts }, 'contacts');
    },

    contactsToSelectArray({ contacts }) {
        return contacts.map(contact => {
            return { label: `${contact.name} - ${contact.email}`, value: contact.id };
        });
    }
};
