'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { listId, contactSample } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }

        const params = {};
        if (contactSample) {
            params.contact_sample = true;
        }

        const list = await lib.apiRequest(context, `/marketing/lists/${listId}`, {
            params
        });

        return context.sendJson(list, 'out');
    }
};
