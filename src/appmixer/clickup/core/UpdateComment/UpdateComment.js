'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { commentId, commentText, assignee, resolved } = context.messages.in.content;
        if (!commentId) {
            throw new context.CancelError('Comment ID is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = {};
        if (commentText !== undefined) {
            body.comment_text = commentText;
        }
        if (assignee !== undefined) {
            body.assignee = assignee;
        }
        if (resolved !== undefined) {
            body.resolved = resolved;
        }

        await clickUpClient.request('PUT', `/comment/${commentId}`, { data: body });

        return context.sendJson({}, 'out');
    }
};
