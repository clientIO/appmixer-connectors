'use strict';
const HubSpot = require('../../Hubspot');

/**
 * Component for fetching list of owners.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { auth } = context;
        const hubSpot = new HubSpot(auth.accessToken, context.config);
        const { data } = await  hubSpot.call('get', 'crm/v3/owners', {}, { query: 'limit=100' });
        return context.sendJson(data.results, 'owners');
    },

    ownersToSelectArray(owners) {

        let transformed = [];

        if (Array.isArray(owners)) {
            owners.forEach(owner => {
                transformed.push({
                    label: `${owner.firstName} ${owner.lastName}`,
                    value: owner.id.toString()
                });
            });
        }

        return transformed;
    }
};
