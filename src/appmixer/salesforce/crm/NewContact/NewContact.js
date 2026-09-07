'use strict';
const commons = require('../lib');
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

const DATE_FIELDS = [
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

/**
 * Reformat a raw contact record's date fields to ISO. Shared by tick() and test()
 * so both emit an identically shaped contact.
 * @param {Object} contact
 * @return {Object} contact
 */
function mapContact(contact) {
    return commons.formatFields(contact, DATE_FIELDS, commons.formatDate);
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
            return context.sendJson(mapContact(contact), 'contact');
        });

        await context.saveState({
            known: current,
            since: since
        });
    },

    async test(context) {

        const contact = await commons.findLatestSObject(context, 'Contact');
        if (!contact) {
            throw new Error('No recent contacts to use as test data.');
        }
        return context.sendJson(mapContact(contact), 'contact');
    }
};
