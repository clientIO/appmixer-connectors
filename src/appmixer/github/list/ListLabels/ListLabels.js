'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of labels from repository
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;
        const items = await lib.apiRequest(context, `repos/${repositoryId}/labels`);
        return context.sendJson(items.data, 'labels');
    }
};
