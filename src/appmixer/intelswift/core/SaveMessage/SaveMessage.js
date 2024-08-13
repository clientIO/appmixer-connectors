'use strict';

const { makeRequest } = require('../../commons');
module.exports = {

    async receive(context) {

        const { contactId, text } = context.messages.in.content;

        const { data } = await makeRequest(context, '/conversation/message', { data: { contactId, text } });

        return context.sendJson(data, 'out');
    }
};
