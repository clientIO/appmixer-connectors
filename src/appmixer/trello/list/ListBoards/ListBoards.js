'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for fetching list of boards
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getBoards = Promise.promisify(client.get, { context: client });

        return getBoards(
            '/1/members/me/boards'
        ).then(res => {
            return commons.sendArrayOutput({
                context,
                outputPortName: 'boards',
                outputType,
                records: res
            });
        });
    },

    // TODO: Add all fields from https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-boards-id-get
    // TODO: Move it to common function for ListBoards, CreateBoard, UpdateBoard and use it in their component.json
    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'closed', value: 'closed' },
                    { label: 'desc', value: 'desc' },
                    { label: 'descData', value: 'descData' },
                    { label: 'id', value: 'id' },
                    { label: 'idOrganization', value: 'idOrganization' },
                    { label: 'labelNames.black', value: 'labelNames.black' },
                    { label: 'labelNames.blue', value: 'labelNames.blue' },
                    { label: 'labelNames.green', value: 'labelNames.green' },
                    { label: 'labelNames.lime', value: 'labelNames.lime' },
                    { label: 'labelNames.orange', value: 'labelNames.orange' },
                    { label: 'labelNames.pink', value: 'labelNames.pink' },
                    { label: 'labelNames.purple', value: 'labelNames.purple' },
                    { label: 'labelNames.red', value: 'labelNames.red' },
                    { label: 'labelNames.sky', value: 'labelNames.sky' },
                    { label: 'name', value: 'name' },
                    { label: 'pinned', value: 'pinned' },
                    { label: 'prefs.background', value: 'prefs.background' },
                    { label: 'prefs.backgroundBrightness', value: 'prefs.backgroundBrightness' },
                    { label: 'prefs.backgroundColor', value: 'prefs.backgroundColor' },
                    { label: 'prefs.backgroundImage', value: 'prefs.backgroundImage' },
                    { label: 'prefs.backgroundImageScaled', value: 'prefs.backgroundImageScaled' },
                    { label: 'prefs.backgroundTile', value: 'prefs.backgroundTile' },
                    { label: 'prefs.calendarFeedEnabled', value: 'prefs.calendarFeedEnabled' },
                    { label: 'prefs.canBeOrg', value: 'prefs.canBeOrg' },
                    { label: 'prefs.canBePrivate', value: 'prefs.canBePrivate' },
                    { label: 'prefs.canBePublic', value: 'prefs.canBePublic' },
                    { label: 'prefs.canInvite', value: 'prefs.canInvite' },
                    { label: 'prefs.cardAging', value: 'prefs.cardAging' },
                    { label: 'prefs.cardCovers', value: 'prefs.cardCovers' },
                    { label: 'prefs.comments', value: 'prefs.comments' },
                    { label: 'prefs.invitations', value: 'prefs.invitations' },
                    { label: 'prefs.permissionLevel', value: 'prefs.permissionLevel' },
                    { label: 'prefs.selfJoin', value: 'prefs.selfJoin' },
                    { label: 'prefs.voting', value: 'prefs.voting' },
                    { label: 'shortUrl', value: 'shortUrl' },
                    { label: 'url', value: 'url' }
                ],
                'boards'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Boards',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'closed': { title: 'closed', type: 'boolean' },
                                    'desc': { title: 'desc', type: 'string' },
                                    'descData': { title: 'descData', type: 'string' },
                                    'id': { title: 'id', type: 'string' },
                                    'idOrganization': { title: 'idOrganization', type: 'string' },
                                    'labelNames.black': { title: 'labelNames.black', type: 'string' },
                                    'labelNames.blue': { title: 'labelNames.blue', type: 'string' },
                                    'labelNames.green': { title: 'labelNames.green', type: 'string' },
                                    'labelNames.lime': { title: 'labelNames.lime', type: 'string' },
                                    'labelNames.orange': { title: 'labelNames.orange', type: 'string' },
                                    'labelNames.pink': { title: 'labelNames.pink', type: 'string' },
                                    'labelNames.purple': { title: 'labelNames.purple', type: 'string' },
                                    'labelNames.red': { title: 'labelNames.red', type: 'string' },
                                    'labelNames.sky': { title: 'labelNames.sky', type: 'string' },
                                    'name': { title: 'name', type: 'string' },
                                    'pinned': { title: 'pinned', type: 'boolean' },
                                    'prefs.background': { title: 'prefs.background', type: 'string' },
                                    'prefs.backgroundBrightness': { title: 'prefs.backgroundBrightness', type: 'string' },
                                    'prefs.backgroundColor': { title: 'prefs.backgroundColor', type: 'string' },
                                    'prefs.backgroundImage': { title: 'prefs.backgroundImage', type: 'string' },
                                    'prefs.backgroundImageScaled': { title: 'prefs.backgroundImageScaled', type: 'string' },
                                    'prefs.backgroundTile': { title: 'prefs.backgroundTile', type: 'string' },
                                    'prefs.calendarFeedEnabled': { title: 'prefs.calendarFeedEnabled', type: 'string' },
                                    'prefs.canBeOrg': { title: 'prefs.canBeOrg', type: 'boolean' },
                                    'prefs.canBePrivate': { title: 'prefs.canBePrivate', type: 'boolean' },
                                    'prefs.canBePublic': { title: 'prefs.canBePublic', type: 'boolean' },
                                    'prefs.canInvite': { title: 'prefs.canInvite', type: 'boolean' },
                                    'prefs.cardAging': { title: 'prefs.cardAging', type: 'string' },
                                    'prefs.cardCovers': { title: 'prefs.cardCovers', type: 'string' },
                                    'prefs.comments': { title: 'prefs.comments', type: 'string' },
                                    'prefs.invitations': { title: 'prefs.invitations', type: 'string' },
                                    'prefs.permissionLevel': { title: 'prefs.permissionLevel', type: 'string' },
                                    'prefs.selfJoin': { title: 'prefs.selfJoin', type: 'boolean' },
                                    'prefs.voting': { title: 'prefs.voting', type: 'string' },
                                    'shortUrl': { title: 'shortUrl', type: 'string' },
                                    'url': { title: 'url', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'boards'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'boards');
        }
    }
};
