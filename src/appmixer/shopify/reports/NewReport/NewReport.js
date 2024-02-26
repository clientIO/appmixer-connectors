'use strict';
const commons = require('../../shopify-commons');

/**
 * Component which triggers whenever new report comes.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const reports = await shopify.report.list({ order: 'updated_at DESC' });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = new Set();
        let diff = new Set();

        if (Array.isArray(reports)) {
            reports.forEach(commons.processItems.bind(null, known, actual, diff));
        }
        await context.saveState({ known: Array.from(actual) });

        if (diff.size) {
            const promises = [];
            diff.forEach(report => {
                promises.push(context.sendJson(report, 'report'));
            });
            return Promise.all(promises);
        }
    }
};
