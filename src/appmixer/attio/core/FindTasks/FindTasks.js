'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'content', 'isCompleted', 'createdAt'],
    properties: {
        id: {
            type: 'string',
            title: 'Task ID',
            example: '649e34f4-c39a-4f4d-99ef-48a36bef8f04'
        },
        workspaceId: {
            type: 'string',
            title: 'Workspace ID',
            example: '14beef7a-99f7-4534-a87e-70b564330a4c'
        },
        content: {
            type: 'string',
            title: 'Content',
            example: 'Follow up on the proposal'
        },
        deadlineAt: {
            type: 'string',
            format: 'date-time',
            title: 'Deadline At',
            example: '2026-10-27T09:00:00.000000000Z'
        },
        isCompleted: {
            type: 'boolean',
            title: 'Is Completed',
            example: false
        },
        completedAt: {
            type: 'string',
            format: 'date-time',
            title: 'Completed At',
            example: '2026-10-21T15:30:00.000000000Z'
        },
        linkedRecords: {
            type: 'array',
            title: 'Linked Records',
            items: {
                type: 'object',
                properties: {
                    targetObjectId: {
                        type: 'string',
                        title: 'Target Object ID'
                    },
                    targetRecordId: {
                        type: 'string',
                        title: 'Target Record ID'
                    }
                }
            },
            example: [
                {
                    targetObjectId: '97052eb9-e65e-443f-a297-f2d9a4a7f795',
                    targetRecordId: 'bf071e1f-6035-429d-b874-d83ea64ea13b'
                }
            ]
        },
        assignees: {
            type: 'array',
            title: 'Assignees',
            items: {
                type: 'object',
                properties: {
                    actorType: {
                        type: 'string',
                        title: 'Actor Type'
                    },
                    actorId: {
                        type: 'string',
                        title: 'Actor ID'
                    }
                }
            },
            example: [
                {
                    actorType: 'workspace-member',
                    actorId: '50cf242c-7fa3-4cad-87d0-75b1af71c57b'
                }
            ]
        },
        createdByActorType: {
            type: 'string',
            title: 'Created By Actor Type',
            example: 'api-token'
        },
        createdByActorId: {
            type: 'string',
            title: 'Created By Actor ID',
            example: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            title: 'Created At',
            example: '2026-10-20T08:00:00.000000000Z'
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { linkedObject, linkedRecordId, assignee, isCompleted, sort, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Tasks', value: 'result' });
        }

        if (linkedRecordId && !linkedObject) {
            throw new context.CancelError('Linked Record Object is required when Linked Record ID is set!');
        }

        const params = { limit: lib.MAX_ITEMS, sort: sort || 'created_at:desc' };
        if (linkedObject) params.linked_object = linkedObject;
        if (linkedRecordId) params.linked_record_id = linkedRecordId;
        if (assignee) params.assignee = assignee;
        if (isCompleted === true || isCompleted === 'true') params.is_completed = true;
        if (isCompleted === false || isCompleted === 'false') params.is_completed = false;

        const data = await lib.apiRequest(context, { path: '/v2/tasks', params });
        const records = (data.data || []).map(lib.mapTask);

        if (records.length === 0) {
            return context.sendJson({ filter: params }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
