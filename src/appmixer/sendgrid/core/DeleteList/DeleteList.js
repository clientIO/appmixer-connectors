'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { listId, deleteContacts } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }

        const params = {};
        if (deleteContacts) {
            params.delete_contacts = true;
        }

        await lib.apiRequest(context, `/marketing/lists/${listId}`, {
            method: 'DELETE',
            params
        });

        return context.sendJson({}, 'out');
    }
};
