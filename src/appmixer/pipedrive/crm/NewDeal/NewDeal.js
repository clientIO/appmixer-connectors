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
 * NewDeal trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const dealsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Deals');

        let response = await dealsApi.getAllAsync({});
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        let deals = response.data;
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let actual = [];
        let diff = [];

        if (Array.isArray(deals)) {
            deals.forEach(processItems.bind(null, known, actual, diff));
        }

        await Promise.map(diff, item => {
            return context.sendJson(item, 'deal');
        });
        await context.saveState({ known: actual });
    }
};
