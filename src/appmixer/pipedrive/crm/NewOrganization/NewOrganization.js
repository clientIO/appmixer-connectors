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
 * NewPerson trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const organizations = await commons.listRecords(context, 'Organizations');
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        organizations.forEach(processItems.bind(null, known, current, diff));

        await Promise.map(diff, item => {
            return context.sendJson(item, 'organization');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        const organization = await commons.fetchLatestExample(context, 'Organizations');
        if (!organization) {
            throw new Error('No organization available to use as test data.');
        }
        return context.sendJson(organization, 'organization');
    }
};
