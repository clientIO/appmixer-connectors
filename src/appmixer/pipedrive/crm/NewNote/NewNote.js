'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * Process items to find newly added.
 * @param {Set} knownItems
 * @param {Array} currentItems
 * @param {Array} newItems
 * @param {Object} item
 */
function processItems(knownItems, currentItems, newItems, item) {

    if (knownItems && !knownItems.has(item.get('id'))) {
        newItems.push(item.toObject());
    }
    currentItems.push(item.get('id'));
}

/**
 * NewNote trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const notes = await commons.listRecords(context, 'Notes');
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        notes.forEach(processItems.bind(null, known, current, diff));

        await Promise.map(diff, item => {
            return context.sendJson(item, 'newNote');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        const note = await commons.fetchLatestExample(context, 'Notes');
        if (!note) {
            throw new Error('No note available to use as test data.');
        }
        return context.sendJson(note, 'newNote');
    }
};
