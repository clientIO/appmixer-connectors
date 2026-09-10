'use strict';
const ZohoClient = require('../../ZohoClient');
const { buildApiObject } = require('../../zoho-commons');

const inputFieldMapping = {
    contactId: 'id',
    attachmentUrl: 'attachmentUrl'
};

/**
 * Update contact in Zoho.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const input = context.messages.contact.content;
        const contact = buildApiObject(input, inputFieldMapping);
        Object.keys(contact).forEach(key => {
            if (typeof contact[key] === 'undefined') {
                delete contact[key];
            }
        });
        // if only ID is present
        if (Object.keys(contact).length < 2) {
            throw new Error('No data to update');
        }
        const client = new ZohoClient(context);
        const { details } = await client.executeRecordsRequest('POST', 'Contacts/'+contact.contactId+'/Attachments', [contact]);

        return context.sendJson(details, 'createContactAttachment');

    }
};
