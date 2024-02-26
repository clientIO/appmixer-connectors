'use strict';
const { makeRequest } = require('../common');

module.exports = {

    async receive(context) {

        const { url, method, body } = context.messages.in.content;
        const apiResponse = await makeRequest({ url, method, body }, context);
        return context.sendJson({ response: apiResponse }, 'out');
    }
};
