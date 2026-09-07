'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * Process items to find newly added.
 * @param {Set} knownItems
 * @param {Set} actualItems
 * @param {Set} newItems
 * @param {Object} item
 */
function processItems(knownItems, actualItems, newItems, item) {

    if (knownItems && !knownItems.has(item.get('id'))) {
        newItems.push(item.toObject());
    }
    actualItems.push(item.get('id'));
}

/**
 * NewPerson trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const persons = await commons.listRecords(context, 'Persons');
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let actual = [];
        let diff = [];

        persons.forEach(processItems.bind(null, known, actual, diff));

        await Promise.map(diff, item => {
            return context.sendJson(item, 'person');
        });
        await context.saveState({ known: actual });
    },

    async test(context) {

        const person = await commons.fetchLatestExample(context, 'Persons');
        if (!person) {
            throw new Error('No person available to use as test data.');
        }
        return context.sendJson(person, 'person');
    }
};
