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

        // tick() emits a checkListForChanges 'changed' entry. With includeOldData that entry
        // carries the new record under `item` and the previous one under `oldItem`. There is
        // no real prior version in Test Mode, so reuse the same deal for both sides and the
        // same observedFieldsMapping tick() uses to keep the shape identical.
        const deal = typeof first.toObject === 'function' ? first.toObject() : first;
        const mapped = observedFieldsMapping(deal);

        return context.sendJson({
            id: deal.id,
            state: 'changed',
            item: deal,
            oldItem: deal,
            ...mapped
        }, 'deal');
    }
};
