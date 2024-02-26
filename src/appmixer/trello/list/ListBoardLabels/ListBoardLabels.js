'use strict';
const commons = require('../../trello-commons');

/**
 * Component for fetching list of labels of a board.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { boardId, outputType, isSource } = context.messages.in.content;

        // Can be called as a source component e.g. from ListBoardCards or ListBoardsLabels. See #1270.
        if (isSource) {
            // When called as a source component, we are interested in actual result
            // only if `boardId` is provided and is not an Appmixer variable in format: `{{{GUID}}}`.
            const skipApiCall = !boardId || commons.isAppmixerVariable(boardId);
            if (skipApiCall) {
                // No point in calling API without valid boardId.
                return context.sendJson([], 'labels');
            }
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/boards/${boardId}/labels?${commons.getAuthQueryParams(context)}`
        });

        //https://api.trello.com/1/boards/kpPww9qv/labels/?fields=color&limit=2
        return commons.sendArrayOutput({
            context,
            outputPortName: 'labels',
            outputType,
            records: data
        });
    }
};
