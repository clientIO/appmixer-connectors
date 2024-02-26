'use strict';
const ZohoClient = require('../../ZohoClient');
const { buildApiObject } = require('../../zoho-commons');

const inputFieldMapping = {
    leadOwner: 'Owner',
    leadSource: 'Lead_Source',
    company: 'Company',
    salutation: 'Salutation',
    firstName: 'First_Name',
    lastName: 'Last_Name',
    email: 'Email',
    title: 'Designation',
    phone: 'Phone',
    fax: 'Fax',
    mobile: 'Mobile',
    website: 'Website',
    leadStatus: 'Lead_Status',
    industry: 'Industry',
    noOfEmployees: 'No_of_Employees',
    rating: 'Rating',
    annualRevenue: 'Annual_Revenue',
    skypeID: 'Skype_ID',
    street: 'Street',
    city: 'City',
    state: 'State',
    zipCode: 'Zip_Code',
    country: 'Country',
    description: 'Description'
};

/**
 * Create new lead in Zoho.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const input = context.messages.lead.content;
        const lead = buildApiObject(input, inputFieldMapping);

        const client = new ZohoClient(context);
        const createdRecord = await client.executeRecordsRequest('POST', 'Leads', [lead]);
        const { details } = createdRecord;
        const newLead = {
            id: details.id,
            created_time: details.Created_Time,
            modified_time: details.Modified_Time,
            modified_by: details.Modified_By.id,
            modified_by_name: details.Modified_By.name,
            created_by: details.Created_By.id,
            created_by_name: details.Created_By.name
        };

        return context.sendJson(newLead, 'newLead');
    }
};
