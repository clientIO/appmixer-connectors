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
 * NewPipeline trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const pipelines = await commons.listRecords(context, 'Pipelines');
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        pipelines.forEach(processItems.bind(null, known, current, diff));

        await Promise.map(diff, item => {
            return context.sendJson(item, 'pipeline');
        });
        await context.saveState({ known: current });
    },

    async test(context) {

        const pipeline = await commons.fetchLatestExample(context, 'Pipelines');
        if (!pipeline) {
            throw new Error('No pipeline available to use as test data.');
        }
        return context.sendJson(pipeline, 'pipeline');
    }
};
