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

        const attendees = emails?.split(',').map(email => ({ emailAddress: { address: email.trim() } }));
        const options = {
            url: `https://graph.microsoft.com/v1.0/me/events`,
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
                subject,
            },
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };

        context.log({ step: 'Making request', options});

        const { data } = await context.httpRequest(options);

        return context.sendJson(data, 'out');
    }
}
