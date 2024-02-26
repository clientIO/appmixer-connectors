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

        const personsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Pipelines');

        let response = await personsApi.getAllAsync({});
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        let pipelines = response.data;
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        if (Array.isArray(pipelines)) {
            pipelines.forEach(processItems.bind(null, known, current, diff));
        }

        await Promise.map(diff, item => {
            return context.sendJson(item, 'pipeline');
        });
        await context.saveState({ known: current });
    }
};
