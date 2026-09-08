'use strict';
const lib = require('../../lib');

/**
 * Component for creating a new pullRequest
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { title, head, base } = context.messages.in.content;
        if (!title) {
            throw new context.CancelError('Title is required!');
        }
        if (!head) {
            throw new context.CancelError('Head branch is required!');
        }
        if (!base) {
            throw new context.CancelError('Base branch is required!');
        }

        const { data } = await lib.apiRequest(context, `repos/${context.properties.repositoryId}/pulls`, {
            method: 'POST',
            body: context.messages.in.content
        });

        return context.sendJson(data, 'out');
    }
};
