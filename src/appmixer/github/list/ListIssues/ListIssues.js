'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of issues from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;
        const items = await lib.apiRequest(context, `repos/${repositoryId}/issues`);
        return context.sendJson(items.data, 'out');
    }
};
