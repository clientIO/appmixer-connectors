'use strict';
const commons = require('../salesforce-commons');

/**
 * Build lead.
 * @param {Object} lead
 * @return {Object} leadObject
 */
function buildLead(lead) {

    let leadObject = {
        Id: lead.leadId
    };

    if (lead['website']) {
        leadObject['Website'] = lead['website'];
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

    if (lead['phone']) {
        leadObject['Phone'] = lead['phone'];
    }

    if (lead['numberOfEmployees']) {
        leadObject['NumberOfEmployees'] = lead['numberOfEmployees'];
    }

    if (lead['mobile']) {
        leadObject['MobilePhone'] = lead['mobile'];
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

    leadObject['Industry'] = lead['industry'] !== 'none' ? lead['industry'] : null;
    leadObject['LeadSource'] = lead['leadSource'] !== 'none' ? lead['leadSource'] : null;
    leadObject['Rating'] = lead['rating'] !== 'none' ? lead['rating'] : null;
    leadObject['Salutation'] = lead['salutation'] !== 'none' ? lead['salutation'] : null;

    return leadObject;
}

/**
 * Update lead in Salesforce.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getSalesforceAPI(context);
        let lead = context.messages.lead.content;
        let leadObject = buildLead(lead);

        return client.sobject('Lead').update(leadObject)
            .then(result => {
                return client.sobject('Lead').retrieve(result['id']);
            })
            .then(result => {
                return context.sendJson(result, 'updatedLead');
            });
    }
};

