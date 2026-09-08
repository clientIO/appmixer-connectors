'use strict';
const commons = require('../lib');

/**
 * Delete an account in Salesforce.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { accountId } = context.messages.in.content;
        if (!accountId) {
            throw new context.CancelError('Account is required!');
        }

        await commons.api.salesForceRq(context, {
            method: 'DELETE',
            action: `sobjects/Account/${accountId}`
        });

        // http 204 No Content on success
        return context.sendJson({}, 'out');
    }
};
