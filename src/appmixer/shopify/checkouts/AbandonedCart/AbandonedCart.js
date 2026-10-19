'use strict';

const lib = require('../../lib');
const gqlStore = require('../../gql-store');

// The abandoned checkouts the trigger compares with on every tick (newest first).
const MAX_CHECKOUTS = 250;

/**
 * Shopify has no "cart abandoned" webhook — abandonment is derived server-side
 * and exposed through the abandoned checkouts list. This trigger polls that
 * list and emits each newly abandoned checkout once. The first tick only
 * records the checkouts that exist already.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const checkouts = await gqlStore(lib.runner(context)).listCheckouts({ max: MAX_CHECKOUTS });
        const state = await context.loadState();
        const known = Array.isArray(state.known) ? new Set(state.known) : null;

        await context.saveState({ known: checkouts.map(checkout => checkout.id) });

        if (!known) {
            return;
        }
        for (const checkout of checkouts.filter(checkout => !known.has(checkout.id)).reverse()) {
            await context.sendJson(checkout, 'out');
        }
    },

    async test(context) {

        const [checkout] = await gqlStore(lib.runner(context)).listCheckouts({ max: 1 });
        if (!checkout) {
            throw new context.CancelError('The store has no abandoned checkouts yet. Start a checkout in the online store and leave it before paying.');
        }
        return context.sendJson(checkout, 'out');
    }
};
