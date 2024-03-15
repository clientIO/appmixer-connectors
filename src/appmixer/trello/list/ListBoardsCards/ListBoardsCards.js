'use strict';
const commons = require('../../trello-commons');

/**
 * Component for fetching list of members of board
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { boardId, outputType, isSource } = context.messages.in.content;

        // Can be called as a source component e.g. from ListBoardCards or ListBoardsLabels. See #1270.
        if (isSource) {
            // When called as a source component, we are interested in actual result
            // only if `boardId` is provided and is not an Appmixer variable in format: `{{{GUID}}}`.
            const skipApiCall = !boardId || commons.isAppmixerVariable(boardId);
            if (skipApiCall) {
                // No point in calling API without valid boardId.
                return context.sendJson([], 'cards');
            }
        }

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://api.trello.com/1/boards/${boardId}/cards?${commons.getAuthQueryParams(context)}`
        });

        return commons.sendArrayOutput({
            context,
            outputPortName: 'cards',
            outputType,
            records: data
        });
    },

    // TODO: Add all fields from https://developer.atlassian.com/cloud/trello/rest/api-group-boards/#api-cards-id-get
    // TODO: Move it to common function for ListBoardsCards, CreateCard, UpdateCard and use it in their component.json
    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'id', value: 'id' },
                    { label: 'badges', value: 'badges' },
                    { label: 'badges.votes', value: 'badges.votes' },
                    { label: 'badges.viewingMemberVoted', value: 'badges.viewingMemberVoted' },
                    { label: 'badges.subscribed', value: 'badges.subscribed' },
                    { label: 'badges.fogbugz', value: 'badges.fogbugz' },
                    { label: 'badges.checkItems', value: 'badges.checkItems' },
                    { label: 'badges.checkItemsChecked', value: 'badges.checkItemsChecked' },
                    { label: 'badges.comments', value: 'badges.comments' },
                    { label: 'badges.attachments', value: 'badges.attachments' },
                    { label: 'badges.description', value: 'badges.description' },
                    { label: 'badges.due', value: 'badges.due' },
                    { label: 'badges.dueComplete', value: 'badges.dueComplete' },
                    { label: 'checkItemStates', value: 'checkItemStates' },
                    { label: 'closed', value: 'closed' },
                    { label: 'dateLastActivity', value: 'dateLastActivity' },
                    { label: 'desc', value: 'desc' },
                    { label: 'descData', value: 'descData' },
                    { label: 'due', value: 'due' },
                    { label: 'dueComplete', value: 'dueComplete' },
                    { label: 'email', value: 'email' },
                    { label: 'idBoard', value: 'idBoard' },
                    { label: 'idChecklists', value: 'idChecklists' },
                    { label: 'idLabels', value: 'idLabels' },
                    { label: 'idList', value: 'idList' },
                    { label: 'idMembers', value: 'idMembers' },
                    { label: 'idShort', value: 'idShort' },
                    { label: 'idAttachmentCover', value: 'idAttachmentCover' },
                    { label: 'manualCoverAttachment', value: 'manualCoverAttachment' },
                    { label: 'labels', value: 'labels' },
                    { label: 'name', value: 'name' },
                    { label: 'pos', value: 'pos' },
                    { label: 'shortUrl', value: 'shortUrl' },
                    { label: 'url', value: 'url' }
                ],
                'cards'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Cards',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'id': { title: 'id', type: 'string' },
                                    'badges': { title: 'badges', type: 'string' },
                                    'badges.votes': { title: 'badges.votes', type: 'string' },
                                    'badges.viewingMemberVoted': { title: 'badges.viewingMemberVoted', type: 'string' },
                                    'badges.subscribed': { title: 'badges.subscribed', type: 'string' },
                                    'badges.fogbugz': { title: 'badges.fogbugz', type: 'string' },
                                    'badges.checkItems': { title: 'badges.checkItems', type: 'string' },
                                    'badges.checkItemsChecked': { title: 'badges.checkItemsChecked', type: 'string' },
                                    'badges.comments': { title: 'badges.comments', type: 'string' },
                                    'badges.attachments': { title: 'badges.attachments', type: 'string' },
                                    'badges.description': { title: 'badges.description', type: 'string' },
                                    'badges.due': { title: 'badges.due', type: 'string' },
                                    'badges.dueComplete': { title: 'badges.dueComplete', type: 'string' },
                                    'checkItemStates': { title: 'checkItemStates', type: 'string' },
                                    'closed': { title: 'closed', type: 'string' },
                                    'dateLastActivity': { title: 'dateLastActivity', type: 'string' },
                                    'desc': { title: 'desc', type: 'string' },
                                    'descData': { title: 'descData', type: 'string' },
                                    'due': { title: 'due', type: 'string' },
                                    'dueComplete': { title: 'dueComplete', type: 'string' },
                                    'email': { title: 'email', type: 'string' },
                                    'idBoard': { title: 'idBoard', type: 'string' },
                                    'idChecklists': { title: 'idChecklists', type: 'string' },
                                    'idLabels': { title: 'idLabels', type: 'string' },
                                    'idList': { title: 'idList', type: 'string' },
                                    'idMembers': { title: 'idMembers', type: 'string' },
                                    'idShort': { title: 'idShort', type: 'string' },
                                    'idAttachmentCover': { title: 'idAttachmentCover', type: 'string' },
                                    'manualCoverAttachment': { title: 'manualCoverAttachment', type: 'string' },
                                    'labels': { title: 'labels', type: 'string' },
                                    'name': { title: 'name', type: 'string' },
                                    'pos': { title: 'pos', type: 'string' },
                                    'shortUrl': { title: 'shortUrl', type: 'string' },
                                    'url': { title: 'url', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'cards'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'cards');
        }
    }
};
