'use strict';
const lib = require('../../lib');

/**
/**
 * Component for fetching list of milestones from repository
 * @extends {Component}
 */
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId } = context.properties;
        const items = await lib.apiRequestPaginated(context, `repos/${repositoryId}/milestones`);
        return context.sendJson(items, 'milestones');
    }
};
