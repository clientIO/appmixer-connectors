'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { by, contactId, email } = context.messages.in.content;

        let contact;

        if (by === 'id') {
            if (!contactId) {
                throw new context.CancelError('Contact ID is required!');
            }
            contact = await lib.apiRequest(context, `/marketing/contacts/${contactId}`);
        } else if (by === 'email') {
            if (!email) {
                throw new context.CancelError('Email is required!');
            }
            const response = await lib.apiRequest(context, '/marketing/contacts/search', {
                method: 'POST',
                data: { query: `email LIKE '${email}'` }
            });
            if (response.result && response.result.length > 0) {
                contact = response.result[0];
            } else {
                throw new context.CancelError('Contact not found.');
            }
        } else {
            throw new context.CancelError('Invalid search type. Use "id" or "email".');
        }

        return context.sendJson(contact, 'out');
    }
};
