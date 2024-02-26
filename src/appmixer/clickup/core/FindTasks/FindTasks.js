'use strict';
const ClickUpClient = require('../../ClickUpClient');
const { sendArrayOutput } = require('../../commons');

const outputPortName = 'tasks';

const commaSeparatedStringToArray = (str) => str?.split(',').map(item => item.trim());


module.exports = {
    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { listId, assigneeIds, statuses, tags, orderBy, outputType, limit } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const cu = new ClickUpClient(context);

        const tasks = await cu.requestPaginated('GET', `/list/${listId}/task`, { dataKey: 'tasks', countLimit: limit, params: { assignees: commaSeparatedStringToArray(assigneeIds), statuses, tags: commaSeparatedStringToArray(tags), order_by: orderBy, paramsSerializer: { indexes: false } } });
        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records: tasks
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object') {
            return context.sendJson([
                { label: 'Task ID', value: 'id' },
                { label: 'Name', value: 'name' },
                { label: 'Status', value: 'status.status' },
                { label: 'Creator ID', value: 'creator.id' },
                { label: 'Creator Username', value: 'creator.username' },
                { label: 'Creator Email', value: 'creator.email' },
                {
                    label: 'Assignees', value: 'assignees', schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', title: 'ID' },
                                username: { type: 'string', title: 'Username' },
                                email: { type: 'string', title: 'Email' }
                            }
                        }
                    }
                },
                {
                    label: 'Watchers', value: 'watchers', schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', title: 'ID' },
                                username: { type: 'string', title: 'Username' },
                                email: { type: 'string', title: 'Email' }
                            }
                        }
                    }
                },
                { label: 'Due Date', value: 'due_date' },
                { label: 'URL', value: 'url' },
                { label: 'List ID', value: 'list.id' },
                { label: 'List Name', value: 'list.name' },
                { label: 'Project ID', value: 'project.id' },
                { label: 'Project Name', value: 'project.name' },
                { label: 'Folder ID', value: 'folder.id' },
                { label: 'Folder Name', value: 'folder.name' },
                { label: 'Space ID', value: 'space.id' }
            ], outputPortName);
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Tasks',
                    value: 'tasks',
                    schema: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', title: 'Task ID' },
                            name: { type: 'string', title: 'Name' },
                            status: { type: 'string', title: 'Status' },
                            'creator.id': { type: 'number', title: 'Creator ID' },
                            'creator.username': { type: 'string', title: 'Creator Username' },
                            'creator.email': { type: 'string', title: 'Creator Email' },
                            assignees: {
                                title: 'Assignees',
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', title: 'ID' },
                                            username: { type: 'string', title: 'Username' },
                                            email: { type: 'string', title: 'Email' }
                                        }
                                    }
                                }
                            },
                            watchers: {
                                title: 'Watchers',
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', title: 'ID' },
                                            username: { type: 'string', title: 'Username' },
                                            email: { type: 'string', title: 'Email' }
                                        }
                                    }
                                }
                            },
                            dueDate: { type: 'string', title: 'Due Date' },
                            url: { type: 'string', title: 'URL' },
                            'list.id': { type: 'string', title: 'List ID' },
                            'list.name': { type: 'string', title: 'List Name' },
                            'project.id': { type: 'string', title: 'Project ID' },
                            'project.name': { type: 'string', title: 'Project Name' },
                            'folder.id': { type: 'string', title: 'Folder ID' },
                            'folder.name': { type: 'string', title: 'Folder Name' },
                            'space.id': { type: 'string', title: 'Space ID' }
                        }
                    }
                }
            ], outputPortName);
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId' }
            ], outputPortName);
        } else {
            // Default to array output
            return context.sendJson([], outputPortName);
        }
    }
};
