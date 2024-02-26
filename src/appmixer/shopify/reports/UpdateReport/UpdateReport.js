'use strict';
const commons = require('../../shopify-commons');

function buildReport(reportInfo) {

    const { id, name } = reportInfo;
    const report = {};

    if (id) {
        report.id = id;
    }

    if (name) {
        report.name = name;
    }

    if (reportInfo.shopify_ql) {
        report.shopify_ql = reportInfo.shopify_ql;
    }

    return report;
}

/**
 * Update a report.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const shopify = commons.getShopifyAPI(context.auth);

        const reportInfo = context.messages.in.content;
        const { id } = reportInfo;
        const updatedReport = await shopify.report.update(id, buildReport(reportInfo));
        return context.sendJson(updatedReport, 'report');
    }
};
