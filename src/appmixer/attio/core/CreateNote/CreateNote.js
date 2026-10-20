'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { objectId, recordId, title, content, format } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Parent Object is required!');
        }
        if (!recordId) {
            throw new context.CancelError('Parent Record ID is required!');
        }
        if (!title) {
            throw new context.CancelError('Title is required!');
        }
        if (!content) {
            throw new context.CancelError('Content is required!');
        }

        const data = await lib.apiRequest(context, {
            method: 'POST',
            path: '/v2/notes',
            data: {
                data: {
                    parent_object: objectId,
                    parent_record_id: recordId,
                    title,
                    format: format || 'plaintext',
                    content
                }
            }
        });

        return context.sendJson(lib.mapNote(data.data), 'out');
    }
};
