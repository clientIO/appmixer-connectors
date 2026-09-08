'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { contactIds, deleteAll } = context.messages.in.content;

        const params = {};

        if (deleteAll) {
            params.delete_all_contacts = 'true';
        } else {
            if (!contactIds) {
                throw new context.CancelError('Contact IDs are required when not deleting all contacts!');
            }
            params.ids = contactIds.replace(/\s/g, '');
        }

        const result = await lib.apiRequest(context, '/marketing/contacts', {
            method: 'DELETE',
            params
        });

        return context.sendJson(result, 'out');
    }
};
