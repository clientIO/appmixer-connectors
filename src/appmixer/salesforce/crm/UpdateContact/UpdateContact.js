'use strict';
const commons = require('../salesforce-commons');

/**
 * Build contact.
 * @return {Object} contactObject
 */
function buildContact(contact) {

    let contactObject = {
        Id: contact.contactId
    };

    if (contact['accountId']) {
        contactObject['AccountId'] = contact['accountId'];
    }

    if (contact['firstName']) {
        contactObject['FirstName'] = contact['firstName'];
    }

    if (contact['lastName']) {
        contactObject['LastName'] = contact['lastName'];
    }

    if (contact['title']) {
        contactObject['Title'] = contact['title'];
    }

    if (contact['department']) {
        contactObject['Department'] = contact['department'];
    }

    if (contact['email']) {
        contactObject['Email'] = contact['email'];
    }

    if (contact['phone']) {
        contactObject['Phone'] = contact['phone'];
    }

    if (contact['fax']) {
        contactObject['Fax'] = contact['fax'];
    }

    if (contact['mobile']) {
        contactObject['MobilePhone'] = contact['mobile'];
    }

    if (contact['mailingStreet']) {
        contactObject['MailingStreet'] = contact['mailingStreet'];
    }

    if (contact['mailingCity']) {
        contactObject['MailingCity'] = contact['mailingCity'];
    }

    if (contact['mailingState']) {
        contactObject['MailingState'] = contact['mailingState'];
    }

    if (contact['mailingZip']) {
        contactObject['MailingPostalCode'] = contact['mailingZip'];
    }

    if (contact['mailingCountry']) {
        contactObject['MailingCountry'] = contact['mailingCountry'];
    }

    contactObject['Salutation'] = contact['salutation'] !== 'none' ? contact['salutation'] : null;

    return contactObject;
}

/**
 * Updates a contact in Salesforce.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getSalesforceAPI(context);
        let contact = context.messages.contact.content;
        let contactObject = buildContact(contact);

        const customFieldsValues = context.messages.contact.content.customFields?.AND || [];
        const customFieldsObject = {};
        if (customFieldsValues.length > 0) {
            customFieldsValues.forEach(customField => {
                customFieldsObject[customField.field] = customField.value;
            });
        }

        return client.sobject('Contact').update({ ...contactObject, ...customFieldsObject })
            .then(result => {
                return client.sobject('Contact').retrieve(result['id']);
            })
            .then(result => {
                return context.sendJson(result, 'updatedContact');
            });
    }
};
