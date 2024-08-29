'use strict';
const emailCommons = require('../gmail-commons');
const Promise = require('bluebird');

module.exports = {
    async tick(context) {
        let newState = {};

        const { labels: { AND: labels } = { AND: [] } } = context.properties;
        const isLabelsEmpty = !labels.some(label => label.name);

        // Fetch all messages without sending labelIds
        const data = await emailCommons.listNewMessages(
            { context, userId: 'me' },
            context.state.id || null
        );

        newState.id = data.lastMessageId;

        const emails = await Promise.map(data.newMessages, async message => {
            return emailCommons.callEndpoint(context, `/users/me/messages/${message.id}`, {
                method: 'GET',
                params: { format: 'full' }
            }).then(response => response.data).catch(err => {
                // email can be deleted (permanently) in gmail between listNewMessages call and
                // this getMessage call, in such case - ignore it and return null
                if (err && err.response && err.response.status === 404) {
                    return null;
                }
                throw err;
            });
        }, { concurrency: 10 });
        // Filter the emails based on selected labels, if any
        await Promise.each(emails || [], async email => {
            if (!email || !email.labelIds) {
                throw new context.CancelError('Invalid email or email label');
            }

            if (isLabelsEmpty || labels.some(label => email.labelIds.includes(label.name))) {
                await context.sendJson(emailCommons.normalizeEmail(email), 'out');
            }
        });

        return context.saveState(newState);
    }
};
