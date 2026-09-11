'use strict';
const commons = require('../lib');
module.exports = {
    async receive(context) {
        if (!context.messages.in.content.emailId) {
            throw new context.CancelError('Email Message ID is required!');
        }
        if ([undefined, null, ''].includes(context.messages.in.content.labels)) {
            throw new context.CancelError('Labels is required!');
        }

        const {
            emailId,
            labels: { AND: labels }
        } = context.messages.in.content;
        const endpoint = `/users/me/messages/${emailId}/modify`;
        const options = {
            method: 'POST',
            data: {
                addLabelIds: labels.map(label => label.name)
            }
        };

        const email = await commons.callEndpoint(context, endpoint, options);
        return context.sendJson(email.data, 'out');
    }
};
