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
            query: queries.ArchiveBoard,
            options: {
                variables: {
                    boardId
                }
            },
            apiKey: context.auth.apiKey,
            context
        });

        await context.sendJson(data['archive_board'], 'out');
    }
};
