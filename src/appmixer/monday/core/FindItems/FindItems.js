'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for making API requests.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }
        const {
            boardId,
            columnId,
            columnValues,
            outputType,
            limit
        } = context.messages.in.content;

        const MAX_LIMIT = limit || 100;
        const defaultLimit = Math.min(MAX_LIMIT, 100);

        const options = {
            query: queries.findItems,
            options: {
                variables: {
                    limit: defaultLimit,
                    boardId: +boardId,
                    columns: {
                        column_id: columnId,
                        column_values: columnValues.split(',').map(col => col.trim())
                    },
                    columnId
                }
            },
            apiKey: context.auth.apiKey
        };

        const nextItemsCursorOptions = {
            query: queries.nextItems,
            options: {
                variables: {
                    limit: defaultLimit,
                    cursor: null,
                    columnId
                }
            },
            apiKey: context.auth.apiKey
        };

        let totalItems = 0;
        let cursor = null;
        let itemsByColValues = [];

        do {
            nextItemsCursorOptions.options.variables.cursor = cursor;
            const data = await commons.makeRequest(cursor ? nextItemsCursorOptions : options);
            itemsByColValues = itemsByColValues.concat(data[`${cursor ? 'next_items_page' : 'items_page_by_column_values'}`]['items']);
            cursor = data[`${cursor ? 'next_items_page' : 'items_page_by_column_values'}`]['cursor'];
            totalItems += itemsByColValues.length;
        } while (cursor && totalItems < MAX_LIMIT);

        let items = [];
        for (const ele of itemsByColValues) {

            let item = {};
            for (const name in ele) {
                if (name === 'parent_item') {
                    item['parent_item_id'] = ele[name] && ele[name]['id'];
                } else if (name === 'group') {
                    item['group_id'] = ele[name] && ele[name]['id'];
                    item['group_title'] = ele[name] && ele[name]['title'];
                } else if (name === 'updates') {
                    item['recent_updates'] = ele[name];
                } else if (name === 'column_values' && ele[name].length) {
                    item[`column_value_${columnId}_id`] = ele[name][0]['id'];
                    item[`column_value_${columnId}_text`] = ele[name][0]['text'];
                    item[`column_value_${columnId}_title`] = ele[name][0]['title'];
                    item[`column_value_${columnId}_type`] = ele[name][0]['type'];
                    item[`column_value_${columnId}_value`] = ele[name][0]['value'];
                    item[`column_value_${columnId}_additional_info`] = ele[name][0]['additional_info'];
                } else {
                    item[name] = ele[name];
                }
            }
            if (outputType === 'item') {
                await context.sendJson(item, 'out');
            } else if (outputType === 'items' || outputType === 'file') {
                items.push(item);
            } else {
                throw new Error('Unsupported outputType ' + outputType);
            }
        }

        if (outputType === 'items') {
            await context.sendJson({ items }, 'out');
        }
        if (outputType === 'file') {
            const headers = Object.keys(items[0]);
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const item of items) {
                const values = headers.map(header => {
                    if (header === 'subscribers') {
                        item[header] = JSON.stringify(item[header]);
                    }
                    const val = item[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const savedFile = await context.saveFileStream(`monday-finditems-${columnId}.csv`, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    getOutputPortOptions(context) {

        const { outputType, columnId } = context.messages.in.content;
        if (outputType === 'item') {
            let options = [
                {
                    label: 'Id',
                    value: 'id'
                },
                {
                    label: 'Name',
                    value: 'name'
                },
                {
                    label: 'Parent Item Id',
                    value: 'parent_item_id'
                },
                {
                    label: 'Created At',
                    value: 'created_at'
                },
                {
                    label: 'Updated At',
                    value: 'updated_at'
                },
                {
                    label: 'Creator Id',
                    value: 'creator_id'
                },
                {
                    label: 'Group Id',
                    value: 'group_id'
                },
                {
                    label: 'Group Title',
                    value: 'group_title'
                },
                {
                    label: 'State',
                    value: 'state'
                },
                {
                    label: 'Subscribers',
                    value: 'subscribers'
                },
                {
                    label: 'Recent Updates',
                    value: 'recent_updates'
                },
                {
                    label: 'Assets',
                    value: 'assets'
                },
                {
                    label: 'Column ID',
                    value: `column_value_${columnId}_id`
                },
                {
                    label: 'Column Text',
                    value: `column_value_${columnId}_text`
                },
                {
                    label: 'Column Title',
                    value: `column_value_${columnId}_title`
                },
                {
                    label: 'Column Type',
                    value: `column_value_${columnId}_type`
                },
                {
                    label: 'Column Value',
                    value: `column_value_${columnId}_value`
                },
                {
                    label: 'Column Additional Info',
                    value: `column_value_${columnId}_additional_info`
                }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{ label: 'Items', value: 'items' }], 'out');
        } else {        // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

