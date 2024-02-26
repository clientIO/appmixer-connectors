'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for fetching list of lists of a board.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardId, outputType, isSource } = context.messages.in.content;

        // Can be called as a source component e.g. from ListBoardCards or ListBoardsLabels. See #1270.
        if (isSource) {
            // When called as a source component, we are interested in actual result
            // only if `boardId` is provided and is not an Appmixer variable in format: `{{{GUID}}}`.
            const skipApiCall = !boardId || commons.isAppmixerVariable(boardId);
            if (skipApiCall) {
                // No point in calling API without valid boardId.
                return context.sendJson([], 'lists');
            }
        }

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getBoardsList = Promise.promisify(client.get, { context: client });

        return getBoardsList(
            '/1/boards/' + boardId + '/lists'
        ).then(res => {
            return commons.sendArrayOutput({
                context,
                outputPortName: 'lists',
                outputType,
                records: res
            });
        });
    },

    // TODO: Add all fields from https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-lists-id-get
    // TODO: Move it to common function for ListBoardsList when other List components exist.
    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'id', value: 'id' },
                    { label: 'name', value: 'name' },
                    { label: 'closed', value: 'closed' },
                    { label: 'pos', value: 'pos' },
                    { label: 'softLimit', value: 'softLimit' },
                    { label: 'idBoard', value: 'idBoard' },
                    { label: 'subscribed', value: 'subscribed' }
                ],
                'lists'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Lists',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'id': { title: 'id', type: 'string' },
                                    'name': { title: 'name', type: 'string' },
                                    'closed': { title: 'closed', type: 'boolean' },
                                    'pos': { title: 'pos', type: 'string' },
                                    'softLimit': { title: 'softLimit', type: 'string' },
                                    'idBoard': { title: 'idBoard', type: 'string' },
                                    'subscribed': { title: 'subscribed', type: 'boolean' }
                                }
                            }
                        }
                    }
                ],
                'lists'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'lists');
        }
    }
};
