'use strict';
const commons = require('../lib');
module.exports = {
    async receive(context) {
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
