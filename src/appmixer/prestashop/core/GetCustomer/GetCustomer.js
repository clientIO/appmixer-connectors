/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { customerId } = context.messages.in.content;

        if (!customerId) {
            throw new context.CancelError('Customer ID is required!');
        }

        const data = await lib.psRequest(context, { path: `/customers/${customerId}` });
        const customer = data.customer;

        if (!customer) {
            throw new context.CancelError(`Customer ${customerId} not found.`);
        }

        // Enrich with the default customer group so the reduction for that group is available.
        let default_group = null;
        if (customer.id_default_group) {
            try {
                const groupData = await lib.psRequest(context, { path: `/groups/${customer.id_default_group}` });
                default_group = groupData.group || null;
            } catch (err) {
                // The group resource may not be granted to the Webservice key - ignore it.
                await context.log({ step: 'Could not load default group', error: err.message });
            }
        }

        return context.sendJson({ ...customer, default_group }, 'out');
    }
};
