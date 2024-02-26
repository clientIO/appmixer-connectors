'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for fetching list of members of board
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getBoardsMembers = Promise.promisify(client.get, { context: client });

        return getBoardsMembers(
            '/1/boards/' + boardId + '/members'
        ).then(res => {
            return commons.sendArrayOutput({
                context,
                outputPortName: 'members',
                outputType,
                records: res
            });
        });
    },

    // TODO: Add all fields from https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-group-members
    // TODO: Move it to common function for ListBoardsMembers when other Member components exist.
    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'id', value: 'id' },
                    { label: 'fullName', value: 'fullName' },
                    { label: 'username', value: 'username' },
                    { label: 'initials', value: 'initials' }
                ],
                'members'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Members',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'id': { title: 'id', type: 'string' },
                                    'fullName': { title: 'fullName', type: 'string' },
                                    'username': { title: 'username', type: 'string' },
                                    'initials': { title: 'initials', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'members'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'members');
        }
    }
};
