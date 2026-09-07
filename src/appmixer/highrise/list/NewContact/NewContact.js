'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Process contacts to find newly added.
 * @param {Set} knownContacts
 * @param {Set} actualContacts
 * @param {Set} newContacts
 * @param {Object} person
 */
function processContacts(knownContacts, actualContacts, newContacts, person) {

    if (knownContacts && !knownContacts.has(person['id'])) {
        newContacts.add(person);
    }
    actualContacts.add(person['id']);
}

/**
 * Component which triggers whenever new contact is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getClient(context);
        let res = await commons.fetchCollection(client.people.get, client.people);
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        res.forEach(processContacts.bind(null, known, actual, diff));

        if (diff.size) {
            await Promise.map(diff, person => {
                return context.sendJson(person, 'contact');
            });
        }

        await context.saveState({ known: Array.from(actual) });
    },

    async test(context) {

        const client = commons.getClient(context);
        const res = await commons.fetchCollection(client.people.get, client.people);
        const person = commons.pickLatest(res);
        if (!person) {
            throw new Error('No recent contacts to use as test data.');
        }
        return context.sendJson(person, 'contact');
    }
};

