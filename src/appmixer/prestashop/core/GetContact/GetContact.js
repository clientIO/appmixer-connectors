/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { contactId } = context.messages.in.content;

        if (!contactId) {
            throw new context.CancelError('Contact ID is required!');
        }

        const data = await lib.psRequest(context, { path: `/contacts/${contactId}` });
        const contact = data.contact;

        if (!contact) {
            throw new context.CancelError(`Contact ${contactId} not found.`);
        }

        return context.sendJson(contact, 'out');
    }
};
