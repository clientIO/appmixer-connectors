'use strict';

const lib = require('../../lib');

/**
 * Component for updating an existing issue or pull request comment.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId, commentId, body } = context.messages.in.content;

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!commentId) {
            throw new context.CancelError('Comment ID is required!');
        }
        if (!body) {
            throw new context.CancelError('Body is required!');
        }

        await lib.apiRequest(context, `repos/${repositoryId}/issues/comments/${commentId}`, {
            method: 'PATCH',
            body: { body }
        });

        return context.sendJson({}, 'out');
    }
};
