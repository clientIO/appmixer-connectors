'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * Map the deal object to the observed object
 * @param  {Object} deal
 * @return {Object}
 */
function observedFieldsMapping(deal) {

    return {
        dealId: deal['id'],
        dealUpdateTime: deal['update_time']
    };
}

/**
 * DealUpdated trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const dealsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Deals');
        const response = await dealsApi.getAllAsync({});

        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        const deals = response.data;
        const { previousState } = context.state || {};

        const {
            changes,
            newState
        } = commons.checkListForChanges(deals, previousState || [], 'id', {
            mappingFunction: observedFieldsMapping,
            includeOldData: true
        });

        await context.saveState({ previousState: newState });

        // if 'previousState' state is null||undefined then this tick is for the first time,
        // so we only build the state and check the changes from this point onwards..
        if (previousState) {
            return Promise.map(changes, item => {
                if (item.state === 'changed') {
                    return context.sendJson(item, 'deal');
                }
            });
        }
    }
};
