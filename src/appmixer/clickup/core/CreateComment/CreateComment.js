'use strict';
const ClickUpClient = require('../../ClickUpClient');

module.exports = {

    async receive(context) {

        const { commentOn, resourceId, commentText, assignee, notifyAll } = context.messages.in.content;
        if (!commentOn) {
            throw new context.CancelError('Comment On is required!');
        }
        if (!resourceId) {
            throw new context.CancelError('Resource ID is required!');
        }
        if (!commentText) {
            throw new context.CancelError('Comment Text is required!');
        }

        const clickUpClient = new ClickUpClient(context);

        const body = { comment_text: commentText };
        if (assignee) {
            body.assignee = assignee;
        }
        if (notifyAll !== undefined) {
            body.notify_all = notifyAll;
        }

        const response = await clickUpClient.request('POST', `/${commentOn}/${resourceId}/comment`, { data: body });

        return context.sendJson(response, 'out');
    }
};
