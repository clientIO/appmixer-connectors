'use strict';
const lib = require('../../lib');

/**
 * Component for updating an issue
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { data } = await lib.apiRequest(context, `repos/${context.properties.repositoryId}/issues/${context.messages.in.content.issue}`, {
            method: 'PATCH',
            body: context.messages.in.content
        });

        return context.sendJson(data, 'out');
    }
};
