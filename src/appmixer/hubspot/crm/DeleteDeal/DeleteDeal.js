'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            dealId
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        await hs.call('delete', `crm/v3/objects/deals/${dealId}`);

        return context.sendJson({ dealId }, 'out');
    }
};
