'use strict';
const ZohoClient = require('../../ZohoClient');
const { buildApiObject } = require('../../zoho-commons');

const inputFieldMapping = {
    leadId: 'id',
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
 * Update lead in Zoho.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const input = context.messages.lead.content;
        const lead = buildApiObject(input, inputFieldMapping);
        Object.keys(lead).forEach(key => {
            if (typeof lead[key] === 'undefined') {
                delete lead[key];
            }
        });
        // if only ID is present
        if (Object.keys(lead).length < 2) {
            throw new Error('No data to update');
        }
        const client = new ZohoClient(context);
        const moduleName = 'Leads';
        const { details } = await client.executeRecordsRequest('PUT', moduleName, [lead]);
        const updatedRecord = await client.getRecord(moduleName, details.id);

        return context.sendJson(updatedRecord, 'updatedLead');
    }
};
