'use strict';

module.exports = {

    async receive(context) {

        const { eventId } = context.messages.in.content;
        const options = {
            url: `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };
        await context.httpRequest(options);

        return context.sendJson({}, 'out');
    }
};
