'use strict';
const ZohoClient = require('../../ZohoClient');

/**
 * Delete contact in Zoho.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { contactId } = context.messages.contact.content;
        const client = new ZohoClient(context);
        const { details } = await client.deleteRecord('Contacts', contactId);
        return context.sendJson({ id: details.id }, 'deletedContact');

    }
};
