'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {

            let subInspector = {};
            if (context.properties.boardId && context.properties.boardId.indexOf('{{{') === -1) {
                subInspector = await context.componentStaticCall('appmixer.monday.core.ListColumns', 'out', {
                    messages: {
                        in: {
                            boardId: context.properties.boardId,
                            groupId: context.properties.groupId
                        }
                    },
                    transform: './ListColumns#columnsToInspector'
                });
            }

            const inspector = {
                schema: {
                    properties: {
                        boardId: {
                            type: 'string'
                        },
                        groupId: {
                            type: 'string'
                        },
                        itemName: {
                            type: 'string'
                        },
                        createLabelsIfMissing: {
                            type: 'boolean'
                        }
                    },
                    required: ['boardId']
                },
                inputs: {
                    boardId: {
                        type: 'select',
                        label: 'Board ID',
                        index: 1,
                        tooltip: 'Select a board.',
                        source: {
                            url: '/component/appmixer/monday/core/ListBoards?outPort=out',
                            data: {
                                properties: { sendWholeArray: true },
                                transform: './ListBoards#boardsToSelectArray'
                            }
                        }
                    },
                    groupId: {
                        type: 'select',
                        label: 'Group ID',
                        index: 2,
                        tooltip: 'Select a group.'
                    },
                    itemName: {
                        type: 'text',
                        label: 'Item Name',
                        index: 3,
                        tooltip: 'Item name.'
                    },
                    createLabelsIfMissing: {
                        type: 'toggle',
                        label: 'Create labels if missing',
                        index: 4,
                        tooltip: 'Create Status/Dropdown labels if they\'re missing.'
                    }
                }
            };

            if (context.properties.boardId && context.properties.boardId.indexOf('{{{') === -1) {
                inspector.inputs.groupId.source = {
                    url: '/component/appmixer/monday/core/ListGroups?outPort=out',
                    data: {
                        messages: {
                            'in/boardId': 'inputs/in/boardId'
                        },
                        transform: './ListGroups#groupsToSelectArray'
                    }
                }
            }

            return context.sendJson({
                schema: Object.assign(subInspector?.schema || {}, inspector.schema),
                inputs: Object.assign(subInspector?.inputs || {}, inspector.inputs),
                groups: subInspector?.groups || {}
            }, 'out');
        }

        const { boardId, groupId, itemName, createLabelsIfMissing, ...columnValues } = context.messages.in.content;
        const data = await commons.makeRequest({
            query: queries.CreateItem,
            options: {
                variables: {
                    boardId: +boardId,
                    groupId,
                    itemName,
                    createLabelsIfMissing,
                    columnValues: JSON.stringify(columnValues)
                }
            },
            apiKey: context.auth.apiKey,
            context
        });

        await context.sendJson(data.create_item, 'out');
    }
};
