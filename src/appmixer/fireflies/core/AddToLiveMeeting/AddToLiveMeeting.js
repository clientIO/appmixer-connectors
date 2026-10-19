'use strict';

const lib = require('../../lib');

module.exports = {
    async receive(context) {

        const { meetingLink, title, password, duration, language } = context.messages.in.content;

        if (!meetingLink) {
            throw new context.CancelError('Meeting Link is required!');
        }

        // Sends the Fireflies notetaker bot into a live meeting. Rate limited to
        // 3 requests per 20 minutes by Fireflies.
        const query = `
            mutation AddToLiveMeeting(
                $meeting_link: String!
                $title: String
                $meeting_password: String
                $duration: Int
                $language: String
            ) {
                addToLiveMeeting(
                    meeting_link: $meeting_link
                    title: $title
                    meeting_password: $meeting_password
                    duration: $duration
                    language: $language
                ) {
                    success
                }
            }
        `;

        const variables = { meeting_link: meetingLink };
        if (title) variables.title = title;
        if (password) variables.meeting_password = password;
        if (duration !== undefined && duration !== null && duration !== '') variables.duration = duration;
        if (language) variables.language = language;

        const data = await lib.makeRequest({ context, query, variables });

        return context.sendJson((data && data.addToLiveMeeting) || {}, 'out');
    }
};
