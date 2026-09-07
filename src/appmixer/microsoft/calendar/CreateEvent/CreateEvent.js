'use strict';

module.exports = {

    async receive(context) {

        const {
            subject,
            start,
            end,
            isAllDay,
            emails,
            body,
            location
        } = context.messages.in.content;

        if (!subject) {
            throw new context.CancelError('Subject is required!');
        }
        if (!start) {
            throw new context.CancelError('Start is required!');
        }
        if (!end) {
            throw new context.CancelError('End is required!');
        }

        const attendees = emails?.split(',').map(email => ({ emailAddress: { address: email.trim() } }));
        const options = {
            url: 'https://graph.microsoft.com/v1.0/me/events',
            method: 'POST',
            data: {
                attendees,
                body: {
                    contentType: 'text',
                    content: body
                },
                end: {
                    dateTime: end,
                    timeZone: 'UTC'
                },
                isAllDay,
                location: {
                    displayName: location
                },
                start: {
                    dateTime: start,
                    timeZone: 'UTC'
                },
                subject
            },
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };

        const { data } = await context.httpRequest(options);

        return context.sendJson(data, 'out');
    }
};
