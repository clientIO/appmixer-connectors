'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { workspaceId, boardName, boardKind } = context.messages.in.content;
        const data = await commons.makeRequest({
            query: queries.CreateBoard,
            options: {
                variables: {
                    workspaceId: +workspaceId,
                    boardName,
                    boardKind
                }
            },
            apiKey: context.auth.apiKey,
            context
        });

        await context.sendJson(data['create_board'], 'out');
    }
};
