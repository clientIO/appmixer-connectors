'use strict';
const ZohoClient = require('../../ZohoClient');
const { buildApiObject } = require('../../zoho-commons');

const inputFieldMapping = {
    contactId: 'id',
    contactOwner: 'Owner',
    leadSource: 'Lead_Source',
    salutation: 'Salutation',
    firstName: 'First_Name',
    lastName: 'Last_Name',
    email: 'Email',
    accountName: 'Account_Name',
    department: 'Department',
    title: 'Title',
    phone: 'Phone',
    fax: 'Fax',
    mobile: 'Mobile',
    assistant: 'Assistant',
    reportsTo: 'Reporting_To',
    skypeID: 'Skype_ID',
    mailingStreet: 'Mailing_Street',
    mailingCity: 'Mailing_City',
    mailingState: 'Mailing_State',
    mailingZip: 'Mailing_Zip',
    mailingCountry: 'Mailing_Country',
    description: 'Description'
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
        const { details } = await client.executeRecordsRequest('PUT', 'Contacts', [contact]);
        const updatedRecord = await client.getRecord('Contacts', details.id);

        return context.sendJson(updatedRecord, 'updatedContact');

    }
};
