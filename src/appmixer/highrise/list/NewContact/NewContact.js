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

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getNewContacts = Promise.promisify(client.people.get, { context: client.people });

        let res = await getNewContacts();
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
    }
};

