'use strict';
const Hubspot = require('../../Hubspot');
const { parseIds } = require('../listMemberships');

module.exports = {

    async receive(context) {

        const { listId, contactIds } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List ID is required!');
        }
        const recordIds = parseIds(contactIds);
        if (!recordIds.length) {
            throw new context.CancelError('At least one contact ID is required!');
        }

        const hs = new Hubspot(context.auth.accessToken, context.config);
        await hs.call('put', `crm/v3/lists/${listId}/memberships/remove`, recordIds);

        return context.sendJson({
            listId,
            contactIds: recordIds,
            count: recordIds.length
        }, 'out');
    }
};
