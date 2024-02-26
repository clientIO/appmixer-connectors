'use strict';
const commons = require('../../shopify-commons');

/**
 * Find report.
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

        const { name, caseSensitive } = context.messages.in.content;
        const filter = caseSensitive ? new RegExp(name, 'i') : new RegExp(name);
        const foundReports = reports.filter(report => filter.test(report.name));

        const promises = [];
        foundReports.forEach(report => {
            promises.push(context.sendJson(report, 'report'));
        });
        return Promise.all(promises);
    }
};
