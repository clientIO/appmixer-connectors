'use strict';

module.exports = {

    async receive(context) {

        const { notificationId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            url: `https://messagetemplate.${context.auth?.subdomain}.zapoj.com/api/incidentAlerts/details/${notificationId}`,
            headers: {
                authorization: `Bearer ${context.auth?.token}`
            }
        });

        const metadata = data?.messages;

        await context.sendJson(metadata, 'out');
    }
};
