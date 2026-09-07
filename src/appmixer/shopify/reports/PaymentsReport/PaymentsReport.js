'use strict';
const commons = require('../../lib');

// Metrics shown by this curated report (verified against the ShopifyQL `payments` dataset).
const METRICS = ['net_payments', 'gross_payments', 'transactions'];

/**
 * Run a payments report over a date range (net and gross payments and transaction count), optionally grouped by day, week or month.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { since, until, groupBy } = context.messages.in.content;
        const query = commons.buildReportQuery('payments', METRICS, { since, until, groupBy });
        const result = await commons.runReport(context, query);
        return context.sendJson(result, 'out');
    }
};
