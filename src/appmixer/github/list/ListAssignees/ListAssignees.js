'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of assignees from repository
 * @extends {Component}
 */
// https://docs.github.com/en/rest/issues/assignees?apiVersion=2022-11-28#list-assignees
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;
        const items = await lib.apiRequest(context, `repos/${repositoryId}/assignees`);
        return context.sendJson(items.data, 'assignees');
    }
};
