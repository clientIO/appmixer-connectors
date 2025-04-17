'use strict';
const lib = require('../../lib');

/**
 * Component for creating comment on an issue
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        let { repositoryId, issue, body } = context.messages.in.content;

        const requestBody = { body: body };

        const { data } = await lib.apiRequest(context, `repos/${repositoryId}/issues/${issue}/comments`, {
            method: 'POST',
            body: requestBody
        });
    
        context.log('data', data);
        return context.sendJson(data, 'out');
    }
};

