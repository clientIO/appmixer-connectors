'use strict';
const commons = require('../../shopify-commons');

/**
 * Get a report.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);
        const { id } = context.messages.in.content;

        const report = await shopify.report.get(id);
        return context.sendJson(report, 'report');
    }
};
