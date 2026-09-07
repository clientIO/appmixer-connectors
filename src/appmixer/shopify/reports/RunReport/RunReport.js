'use strict';
const commons = require('../../lib');

/**
 * Run a ShopifyQL query through the GraphQL Admin API (shopifyqlQuery) and
 * return the resulting table. This replaces the deprecated, plan-gated REST
 * Report resource.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { query } = context.messages.in.content;

        if (!query) {
            throw new context.CancelError('ShopifyQL query is required!');
        }

        const result = await commons.runReport(context, query);
        return context.sendJson(result, 'out');
    }
};
