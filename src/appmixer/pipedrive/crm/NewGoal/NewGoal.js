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
 * NewGoal trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const goals = await commons.listRecords(context, 'Goals', { everyone: 1 });
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        goals.forEach(processItems.bind(null, known, current, diff));

        await Promise.map(diff, item => {
            return context.sendJson(item, 'goal');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        const goal = await commons.fetchLatestExample(context, 'Goals', { everyone: 1 });
        if (!goal) {
            throw new Error('No goal available to use as test data.');
        }
        return context.sendJson(goal, 'goal');
    }
};
