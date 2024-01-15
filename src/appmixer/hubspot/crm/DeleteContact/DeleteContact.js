'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            contactId
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        await hs.call('delete', `crm/v3/objects/contacts/${contactId}`);

        return context.sendJson({ contactId }, 'out');
    }
};
