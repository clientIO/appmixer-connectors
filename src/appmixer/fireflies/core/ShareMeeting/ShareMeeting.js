'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const { transcriptId, emails, expiry } = context.messages.in.content;

        if (!transcriptId) {
            throw new context.CancelError('Transcript ID is required!');
        }

        const emailList = (emails || '')
            .split(',')
            .map(email => email.trim())
            .filter(Boolean);

        if (emailList.length === 0) {
            throw new context.CancelError('At least one email address is required!');
        }

        // Rate limited by Fireflies to 10 requests per hour, max 50 emails per call.
        const query = `
            mutation ShareMeeting($input: ShareMeetingInput!) {
                shareMeeting(input: $input) {
                    success
                }
            }
        `;

        const variables = { input: { meeting_id: transcriptId, emails: emailList } };
        if (expiry !== undefined && expiry !== null && expiry !== '') {
            variables.input.expiry_days = parseInt(expiry, 10);
        }

        const data = await lib.makeRequest({ context, query, variables });

        return context.sendJson((data && data.shareMeeting) || {}, 'out');
    }
};
