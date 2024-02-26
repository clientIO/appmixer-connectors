'use strict';

module.exports = {

    async receive(context) {

        const {
            eventId,
            subject,
            start,
            end,
            isAllDay,
            emails,
            body,
            location
        } = context.messages.in.content;

        // Attendees are not mandatory when updating an event.
        const attendees = emails?.split(',').map(email => ({ emailAddress: { address: email } }));
        const options = {
            url: `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
            method: 'PATCH',
            data: {
                attendees,
                body: {
                    contentType: 'text',
                    content: body
                },
                isAllDay,
                subject
            },
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };

        if (end) {
            options.data.end = {
                dateTime: end,
                timeZone: 'UTC'
            };
        }
        if (start) {
            options.data.start = {
                dateTime: start,
                timeZone: 'UTC'
            };
        }
        if (location) {
            options.data.location = {
                displayName: location
            };
        }

        context.log({ step: 'Making request', options });

        const { data } = await context.httpRequest(options);

        return context.sendJson(data, 'out');
    }
};
