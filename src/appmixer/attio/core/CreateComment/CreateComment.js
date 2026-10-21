'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { objectId, recordId, threadId, content, authorId } = context.messages.in.content;

        if (!content) {
            throw new context.CancelError('Content is required!');
        }
        if (!authorId) {
            throw new context.CancelError('Author is required!');
        }
        if (!threadId && (!objectId || !recordId)) {
            throw new context.CancelError('Either Thread ID, or Record Object and Record ID are required!');
        }

        const comment = {
            format: 'plaintext',
            content,
            author: { type: 'workspace-member', id: authorId }
        };
        if (threadId) {
            comment.thread_id = threadId;
        } else {
            comment.record = { object: objectId, record_id: recordId };
        }

        const data = await lib.apiRequest(context, { method: 'POST', path: '/v2/comments', data: { data: comment } });
        return context.sendJson(lib.mapComment(data.data), 'out');
    }
};
