'use strict';
const notionCommons = require('../../notion-commons');

module.exports = {
    async receive(context) {
        const databaseId = context.properties.databaseId;

        const response = await notionCommons.callEndpoint(context, `/databases/${databaseId}`, {
            method: 'GET'
        });

        await context.sendJson(response.data, 'out');
    }
};
