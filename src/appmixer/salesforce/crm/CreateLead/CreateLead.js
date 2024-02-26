'use strict';
const commons = require('../salesforce-commons');

/**
 * Build lead.
 * @param {Object} lead
 * @return {Object} leadObject
 */
function buildLead(lead) {

    let leadObject = {
        LastName: lead.lastName,
        Company: lead.company,
        Status: lead.leadStatus
    };

    if (lead['website']) {
        leadObject['Website'] = lead['website'];
    }

    if (lead['salutation']) {
        leadObject['Salutation'] = lead['salutation'];
    }

    if (lead['firstName']) {
        leadObject['FirstName'] = lead['firstName'];
    }

    if (lead['title']) {
        leadObject['Title'] = lead['title'];
    }

    if (lead['email']) {
        leadObject['Email'] = lead['email'];
    }

    if (lead['industry']) {
        leadObject['Industry'] = lead['industry'];
    }

    if (lead['phone']) {
        leadObject['Phone'] = lead['phone'];
    }

    if (lead['numberOfEmployees']) {
        leadObject['NumberOfEmployees'] = lead['numberOfEmployees'];
    }

    if (lead['mobile']) {
        leadObject['MobilePhone'] = lead['mobile'];
    }

    if (lead['leadSource']) {
        leadObject['LeadSource'] = lead['leadSource'];
    }

    if (lead['rating']) {
        leadObject['Rating'] = lead['rating'];
    }

    if (lead['street']) {
        leadObject['Street'] = lead['street'];
    }

    if (lead['city']) {
        leadObject['City'] = lead['city'];
    }

    if (lead['state']) {
        leadObject['State'] = lead['state'];
    }

    if (lead['postalCode']) {
        leadObject['PostalCode'] = lead['postalCode'];
    }

    if (lead['country']) {
        leadObject['Country'] = lead['country'];
    }

    return leadObject;
}


/**
 * Create new lead in Salesforce.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getSalesforceAPI(context);
        let lead = context.messages.lead.content;
        let leadObject = buildLead(lead);

        return client.sobject('Lead').create(leadObject)
            .then(result => {
                return client.sobject('Lead').retrieve(result['id']);
            })
            .then(result => {
                return context.sendJson(result, 'newLead');
            });
    }
};

