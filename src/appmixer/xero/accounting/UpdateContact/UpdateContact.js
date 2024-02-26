'use strict';
const XeroClient = require('../../XeroClient');

module.exports = {

    /**
     * @todo: Add rest of the fields to allow for full update of contact.
     */
    async receive(context) {

        const {
            tenantId,
            ContactID,
            ContactStatus
        } = context.messages.in.content;

        const data = {
            ContactID,
            ContactStatus
        };

        const xc = new XeroClient(context, tenantId);
        const { Contacts } = await xc.request('POST', '/api.xro/2.0/Contacts', { data });

        return context.sendJson(Contacts[0], 'out');
    }
};
