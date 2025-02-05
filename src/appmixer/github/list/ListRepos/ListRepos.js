'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of repositories
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { data } = await lib.callEndpoint(context, 'user/repos');
        return context.sendJson(data, 'repositories');
    }
};
