'use strict';
const lib = require('../../lib');

/**
 * Component for creating a new pullRequest
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { data } = await lib.apiRequest(context, `repos/${context.properties.repositoryId}/pulls`, {
            method: 'POST',
            body: context.messages.in.content
        });

        return context.sendJson(data, 'out');
    }
};
