'use strict';
const lib = require('../../lib');

/**
 * Component for fetching an organization by name
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { organization } = context.properties;
        const response = await lib.apiRequest(context, `orgs/${organization}`);
        return context.sendJson(response.data, 'out');
    }
};
