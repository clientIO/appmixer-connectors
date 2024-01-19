'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { itemId } = context.messages.in.content;
        const data = await commons.makeRequest({
            query: queries.DeleteItem,
            options: {
                variables: {
                    itemId
                }
            },
            apiKey: context.auth.apiKey,
            context
        });

        await context.sendJson(data['delete_item'], 'out');
    }
};
