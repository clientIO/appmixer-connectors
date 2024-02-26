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

        const organizationsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Organizations');

        let response = await organizationsApi.getAllAsync({});
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        let organizations = response.data;
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let current = [];
        let diff = [];

        if (Array.isArray(organizations)) {
            organizations.forEach(processItems.bind(null, known, current, diff));
        }

        await Promise.map(diff, item => {
            return context.sendJson(item, 'organization');
        });
        await context.saveState({ known: current });
    }
};
