'use strict';
const commons = require('../lib');

/**
 * Component for fetching list of accounts
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const isSource = !!(context.properties
            && (context.properties.isSource || context.properties.variableFetch));

        try {
            const accounts = isSource
                ? await commons.listAccountsCached(context)
                : await commons.listAccounts(context);

            return context.sendJson(accounts, 'accounts');
        } catch (err) {
            if (isSource) {
                // Never break the inspector dropdown on API failures.
                return context.sendJson([], 'accounts');
            }
            throw err;
        }
    }
};
