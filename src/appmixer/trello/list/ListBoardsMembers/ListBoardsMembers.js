'use strict';
const commons = require('../../trello-commons');

/**
 * Component for fetching list of members of board
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/boards/${boardId}/members?${commons.getAuthQueryParams(context)}`
        });

        return commons.sendArrayOutput({
            context,
            outputPortName: 'members',
            outputType,
            records: data
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
