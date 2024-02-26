'use strict';

module.exports = {

    async receive(context) {

        const { eventId } = context.messages.in.content;
        const options = {
            url: `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };
        const { data } = await context.httpRequest(options);

        return context.sendJson(data, 'out');
    }
}
