'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {
        const { noteId } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        // https://developers.hubspot.com/docs/api/crm/notes
        await hs.call('delete', `crm/v3/objects/notes/${noteId}`);

        return context.sendJson({}, 'out');
    }
};
