'use strict';
const commons = require('../../shopify-commons');

/**
 * Create report.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const reportInfo = context.messages.in.content;
        const report = await shopify.report.create(reportInfo);
        return context.sendJson(report, 'report');
    }
};
