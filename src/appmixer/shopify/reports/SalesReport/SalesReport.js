'use strict';
const commons = require('../../lib');

// Metrics shown by this curated report (verified against the ShopifyQL `sales` dataset).
const METRICS = ['total_sales', 'gross_sales', 'net_sales', 'orders', 'discounts', 'returns', 'taxes', 'average_order_value'];

/**
 * Run a sales report over a date range (total, gross and net sales, orders, discounts, returns, taxes
 * and average order value), optionally grouped by day, week or month.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { since, until, groupBy } = context.messages.in.content;
        const query = commons.buildReportQuery('sales', METRICS, { since, until, groupBy });
        const result = await commons.runReport(context, query);
        return context.sendJson(result, 'out');
    }
};
