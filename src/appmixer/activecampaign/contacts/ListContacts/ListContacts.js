'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const {
            filter,
            limit = 100,
            search,
            status
        } = context.messages.in.content;

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        let params = {};

        if (filter) {
            if (search) {
                params.search = search;
            }
            params.status = status;

            params = trimUndefined(params);
        }

        const contacts = await ac.getContacts(params, limit);

        return context.sendJson({ contacts }, 'contacts');
    },

    contactsToSelectArray({ contacts }) {

        return contacts.map(contact => {
            const label = contact.firstName
                ? `${contact.firstName} ${contact.lastName} - ${contact.email}`
                : contact.email;
            return { label, value: contact.id };
        });
    }
};
