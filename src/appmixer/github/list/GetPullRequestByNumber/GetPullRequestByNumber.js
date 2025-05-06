'use strict';
const lib = require('../../lib');

/**
 * Component for fetching pull request by PR number from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { repositoryId, number } = context.properties;
        const data = await lib.apiRequest(context, `repos/${repositoryId}/pulls/${number}`);
        return context.sendJson(data.data, 'pullRequest');
    }
};
