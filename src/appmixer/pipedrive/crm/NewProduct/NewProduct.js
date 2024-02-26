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
 * NewProduct trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const productsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Products');

        let response = await productsApi.getAllAsync({});
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        let products = response.data;
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        if (Array.isArray(products)) {
            products.forEach(processItems.bind(null, known, current, diff));
        }

        await Promise.map(diff, item => {
            return context.sendJson(item, 'product');
        });
        await context.saveState({ known: current });
    }
};
