'use strict';
const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        let contacts;

        try {
            const { data } = await apiCall(context, { url: '/contacts' });
            contacts = data;
        } catch (e) {
            const code = e.response?.data?.code || e.response?.body?.code;
            if (code === 'access_denied') {
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
