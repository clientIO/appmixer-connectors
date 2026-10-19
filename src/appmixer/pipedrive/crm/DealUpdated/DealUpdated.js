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

        const deals = await commons.listRecords(context, 'Deals');
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
    },

    async test(context) {

        const deals = await commons.listRecords(context, 'Deals');
        const first = deals[0];
        if (!first) {
            throw new Error('No deal available to use as test data.');
        }

        // tick() emits a checkListForChanges 'changed' entry: the new record under `item` and,
        // under `oldItem`, what was stored for it in state — the observedFieldsMapping output
        // ({ dealId, dealUpdateTime }), not the whole previous deal. Mirror that shape.
        const deal = typeof first.toObject === 'function' ? first.toObject() : first;

        return context.sendJson({
            item: deal,
            oldItem: observedFieldsMapping(deal),
            state: 'changed'
        }, 'deal');
    }
};
