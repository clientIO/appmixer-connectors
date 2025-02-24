'use strict';
const emailCommons = require('../lib');
const Promise = require('bluebird');

module.exports = {
    async tick(context) {
        let newState = {};

        // Retrieve all starred message IDs
        const messages = await emailCommons.getAllMessageIds({
            context,
            userId: 'me',
            labelIds: ['STARRED']
        });

        const knownMessages = new Set(context.state.known || []);
        const currentMessages = [];
        const newMessages = [];

        messages.forEach(message => {
            currentMessages.push(message.id);
            if (!knownMessages.has(message.id)) {
                if (context.state.known) {
                    newMessages.push(message);
                }
            }
        });

        newState.known = currentMessages;

        await context.saveState(newState);

        if (context.state.known) {
            const emails = await Promise.map(newMessages, async message => {
                return emailCommons.callEndpoint(context, `/users/me/messages/${message.id}`, {
                    method: 'GET',
                    params: { format: 'full' }
                }).then(response => response.data).catch(err => {
                    if (err && err.response && err.response.status === 404) {
                        return null;
                    }
                    throw err;
                });
            }, { concurrency: 10 });

            await Promise.each(emails || [], async email => {
                if (!email || !email.labelIds) {
                    throw new context.CancelError('Invalid email or email label');
                }
                await context.sendJson(emailCommons.normalizeEmail(email), 'out');
            });
        }
    }
};
