'use strict';
const commons = require('../lib');

module.exports = {
    async receive(context) {
        const endpoint = '/users/me/labels';
        const options = {
            method: 'POST',
            data: context.messages.in.content,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const result = await commons.callEndpoint(context, endpoint, options);
        return context.sendJson(result.data, 'out');
    }
};
