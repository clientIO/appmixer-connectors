'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of branches from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;

        const { data } = await lib.callEndpoint(context, `repos/${repositoryId}/branches`);

        return context.sendJson(data, 'branches');
    }
};

