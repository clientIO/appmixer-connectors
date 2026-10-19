'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const { transcriptId, title } = context.messages.in.content;

        if (!transcriptId) {
            throw new context.CancelError('Transcript ID is required!');
        }
        if (!title) {
            throw new context.CancelError('Title is required!');
        }

        const query = `
            mutation UpdateMeetingTitle($input: UpdateMeetingTitleInput!) {
                updateMeetingTitle(input: $input) {
                    title
                }
            }
        `;

        await lib.makeRequest({ context, query, variables: { input: { id: transcriptId, title } } });

        return context.sendJson({}, 'out');
    }
};
