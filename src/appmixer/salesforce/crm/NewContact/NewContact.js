'use strict';
const commons = require('../salesforce-commons');
const Promise = require('bluebird');

/**
 * Process contacts to find newly added.
 * @param {Set} knownContacts
 * @param {Array} currentContacts
 * @param {Array} newContacts
 * @param {Object} contact
 */
function processContacts(knownContacts, currentContacts, newContacts, contact) {

    if (knownContacts && !knownContacts.has(contact['Id'])) {
        newContacts.push(contact);
    }
    currentContacts.push(contact['Id']);
}

/**
 * Component which triggers whenever new contact is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getSalesforceAPI(context);
        let since = new Date();

        let res = await client.sobject('Contact').find({
            CreatedDate: {
                $gte: commons.Date.toDateTimeLiteral(context.state.since || since)
            }
        });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (res.length) {
            res.forEach(processContacts.bind(null, known, current, diff));
        }

        await Promise.map(diff, contact => {
            let dates = [
                'CreatedDate',
                'EmailBouncedDate',
                'LastActivityDate',
                'LastCURequestDate',
                'LastCUUpdateDate',
                'LastModifiedDate',
                'LastReferencedDate',
                'LastViewedDate',
                'SystemModstamp'
            ];
            contact = commons.formatFields(contact, dates, commons.formatDate);
            return context.sendJson(contact, 'contact');
        });

        await context.saveState({
            known: current,
            since: since
        });
    }
};
