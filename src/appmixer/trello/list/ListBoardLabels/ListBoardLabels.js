'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for fetching list of labels of a board.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

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

        //https://api.trello.com/1/boards/kpPww9qv/labels/?fields=color&limit=2
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let get = Promise.promisify(client.get, { context: client });

        return get(`/1/boards/${boardId}/labels`).then(res => {
            return commons.sendArrayOutput({
                context,
                outputPortName: 'labels',
                outputType,
                records: res
            });
        });
    }
};
