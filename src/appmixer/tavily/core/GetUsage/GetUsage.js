'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const response = await lib.makeRequest({ context, method: 'GET', path: '/usage' });

        const key = (response && response.key) || {};
        const account = (response && response.account) || {};

        // Flatten the two nested sections into one message: the key-level counters
        // are what a flow throttles on, the account-level ones are the plan totals.
        return context.sendJson({
            key_usage: key.usage,
            key_limit: key.limit,
            plan: account.current_plan,
            plan_usage: account.plan_usage,
            plan_limit: account.plan_limit,
            paygo_usage: account.paygo_usage,
            paygo_limit: account.paygo_limit,
            search_usage: account.search_usage,
            extract_usage: account.extract_usage,
            crawl_usage: account.crawl_usage,
            map_usage: account.map_usage
        }, 'out');
    }
};
