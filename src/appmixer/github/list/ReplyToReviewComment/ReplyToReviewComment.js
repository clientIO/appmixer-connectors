'use strict';

const lib = require('../../lib');

/**
 * Component for replying inside an existing pull request review thread.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { repositoryId, pullRequestNumber, commentId, body } = context.messages.in.content;

        if (!repositoryId) {
            throw new context.CancelError('Repository is required!');
        }
        if (!pullRequestNumber) {
            throw new context.CancelError('Pull Request Number is required!');
        }
        if (!commentId) {
            throw new context.CancelError('Comment ID is required!');
        }
        if (!body) {
            throw new context.CancelError('Body is required!');
        }

        // Replying to any comment of a thread appends to that thread; GitHub resolves the
        // root itself, so the ID of the comment being answered is enough.
        const { data } = await lib.apiRequest(
            context,
            `repos/${repositoryId}/pulls/${pullRequestNumber}/comments/${commentId}/replies`,
            { method: 'POST', body: { body } }
        );

        return context.sendJson(data, 'out');
    }
};
