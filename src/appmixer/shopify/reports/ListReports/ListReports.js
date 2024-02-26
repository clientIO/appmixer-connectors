'use strict';
const commons = require('../../shopify-commons');

/**
 * List all reports.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const params = {
            limit: 50
        };
        const reports = await commons.pager({
            shopify,
            target: 'report',
            operation: 'list',
            params
        });
        return context.sendJson(reports, 'reports');
    },

    reportsToSelectArray(reports) {

        if (reports && Array.isArray(reports)) {
            return reports.map(report => ({
                label: report.name,
                value: report.id
            }));
        }
        return [];
    }
};
