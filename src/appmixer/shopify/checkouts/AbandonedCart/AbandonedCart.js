'use strict';
const commons = require('../../lib');

/**
 * Shopify has no "cart abandoned" webhook — abandonment is derived server-side and
 * exposed through the abandoned-checkouts list. This trigger polls that list and
 * emits each newly abandoned checkout once.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const shopify = commons.getShopifyAPI(context);

        const checkouts = await shopify.checkout.list({ limit: 250 });
        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const actual = new Set();
        const diff = new Set();

        if (Array.isArray(checkouts)) {
            checkouts.forEach(commons.processItems.bind(null, known, actual, diff));
        }
        await context.saveState({ known: Array.from(actual) });

        if (diff.size) {
            const promises = [];
            diff.forEach(checkout => {
                promises.push(context.sendJson(checkout, 'checkout'));
            });
            return Promise.all(promises);
        }
    },

    async test(context) {

        const shopify = commons.getShopifyAPI(context);
        const checkouts = await shopify.checkout.list({ limit: 1 });
        const checkout = Array.isArray(checkouts) ? checkouts[0] : null;

        if (!checkout) {
            throw new Error('No abandoned checkouts to use as test data.');
        }
        return context.sendJson(checkout, 'checkout');
    }
};
