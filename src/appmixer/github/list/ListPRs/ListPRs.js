'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of PRs from repository for inspectors
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { repositoryId } = context.properties;
        const items = await lib.apiRequest(context, `repos/${repositoryId}/pulls`);
        return context.sendJson(items.data, 'out');
    }
};
