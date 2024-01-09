'use strict';
const commons = require('../../monday-commons');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { query } = context.messages.in.content;
        const data = await commons.makeRequest({
            query,
            apiKey: context.auth.apiKey
        });
        const response = { response: data };
        return context.sendJson(response, 'out');
    }
};
