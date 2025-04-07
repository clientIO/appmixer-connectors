'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of milestones from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;
        const items = await lib.apiRequest(context, `repos/${repositoryId}/milestones`);
        return context.sendJson(items.data, 'milestones');
    }
};
