'use strict';
const ZohoClient = require('../../ZohoClient');
const { buildApiObject } = require('../../zoho-commons');

const inputFieldMapping = {
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
 * Create new contact in Zoho.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const input = context.messages.contact.content;
        const contact = buildApiObject(input, inputFieldMapping);

        const client = new ZohoClient(context);
        const createdRecord = await client.executeRecordsRequest('POST', 'Contacts', [contact]);
        const { details } = createdRecord;
        const newContact = {
            id: details.id,
            created_time: details.Created_Time,
            modified_time: details.Modified_Time,
            modified_by: details.Modified_By.id,
            modified_by_name: details.Modified_By.name,
            created_by: details.Created_By.id,
            created_by_name: details.Created_By.name
        };
        return context.sendJson(newContact, 'newContact');

    }
};
