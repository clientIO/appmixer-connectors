'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of labels from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId, number } = context.properties;
        const pullRequest = await lib.apiRequest(context, `repos/${repositoryId}/pulls/${number}`);
        return context.sendJson(pullRequest.data, 'pullRequest');
    }
};
