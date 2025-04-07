'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of branches from repository
 */
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;
        const items = await lib.apiRequest(context, `repos/${repositoryId}/branches`);
        return context.sendJson(items.data, 'branches');
    }
};

