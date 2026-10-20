'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { noteId } = context.messages.in.content;

        if (!noteId) {
            throw new context.CancelError('Note ID is required!');
        }

        await lib.apiRequest(context, { method: 'DELETE', path: '/v2/notes/' + encodeURIComponent(noteId) });

        return context.sendJson({}, 'out');
    }
};
