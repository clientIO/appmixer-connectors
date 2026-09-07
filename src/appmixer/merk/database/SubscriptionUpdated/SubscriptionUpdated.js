'use strict';
const merk = require('../../merk-commons');

/**
 * Fetch the current subscriptions object. Shared by tick() and test().
 * @param {Object} context
 * @returns {Promise<Object>}
 */
async function fetchSubscriptions(context) {
    return merk.get('/subscriptions/', context.auth.apiKey, {});
}

module.exports = {

    async tick(context) {

        let subscriptions = await fetchSubscriptions(context);
        let known = context.state.known;
        if (JSON.stringify(known) !== JSON.stringify(subscriptions)) {
            await context.sendJson(subscriptions, 'subscription');
            await context.saveState({ known: subscriptions });
        }
    },

    async test(context) {

        // Fetch the current subscriptions without the state baseline so a real
        // example is always emitted, mirroring tick()'s output shape and port.
        const subscriptions = await fetchSubscriptions(context);
        if (!subscriptions) {
            throw new Error('No subscription information available to use as test data.');
        }
        return context.sendJson(subscriptions, 'subscription');
    }
};
