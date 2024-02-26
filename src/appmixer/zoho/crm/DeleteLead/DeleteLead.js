'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Delete lead in Zoho.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { leadId } = context.messages.lead.content;
        const client = new ZohoClient(context);
        const { details } = await client.deleteRecord('Leads', leadId);
        return context.sendJson({ id: details.id }, 'deletedLead');

    }
};
