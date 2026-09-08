'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { name } = context.messages.in.content;

        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const list = await lib.apiRequest(context, '/marketing/lists', {
            method: 'POST',
            data: { name }
        });

        return context.sendJson(list, 'out');
    }
};
