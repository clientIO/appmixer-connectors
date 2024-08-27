'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const databaseId = context.messages.in.content.databaseId;

        const response = await lib.callEndpoint(context, `/databases/${databaseId}`
        );

        await context.sendJson(response.data, 'out');
    }
};
