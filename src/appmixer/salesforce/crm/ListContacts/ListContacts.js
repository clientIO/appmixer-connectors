'use strict';
const commons = require('../salesforce-commons');

/**
 * Component for fetching list of contacts
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getSalesforceAPI(context);
        const contactToOmit = context.properties.contactId;

        return client.sobject('Contact').find()
            .then(res => {
                if (contactToOmit) {
                    res = res.filter(contact => contact['Id'] !== contactToOmit);
                }
                return context.sendJson(res, 'contacts');
            });
    }
};

