'use strict';
const lib = require('../../lib');

/**
 * Component for updating a new pullRequest
 * @extends {Component}
 */
module.exports = {

    async receive(context) {
        const { pullRequest, title = '', body = '', base = '', state = '' } = context.messages.in.content;
        let requestData = {};
        if (title) requestData.title = title;
        if (body) requestData.body = body;
        if (base) requestData.base = base;
        if (state) requestData.state = state;
        const { data } = await lib.apiRequest(context, `repos/${context.properties.repositoryId}/pulls/${pullRequest}`, {
            method: 'PATCH',
            body: requestData
        });

        return context.sendJson(data, 'out');
    }
};
