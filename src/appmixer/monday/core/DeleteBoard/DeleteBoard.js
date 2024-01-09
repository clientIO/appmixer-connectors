'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { boardId } = context.messages.in.content;
        const data = await commons.makeRequest({
            query: queries.DeleteBoard,
            options: {
                variables: {
                    boardId: +boardId
                }
            },
            apiKey: context.auth.apiKey,
            context
        });

        await context.sendJson(data['delete_board'], 'out');
    }
};
