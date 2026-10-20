'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'parentObject', 'parentRecordId', 'title', 'createdAt'],
    properties: {
        id: {
            type: 'string',
            title: 'Note ID',
            example: 'ff3f3bd4-40f4-4f80-8187-cd02385af424'
        },
        workspaceId: {
            type: 'string',
            title: 'Workspace ID',
            example: '14beef7a-99f7-4534-a87e-70b564330a4c'
        },
        parentObject: {
            type: 'string',
            title: 'Parent Object',
            example: 'companies'
        },
        parentRecordId: {
            type: 'string',
            title: 'Parent Record ID',
            example: 'bf071e1f-6035-429d-b874-d83ea64ea13b'
        },
        title: {
            type: 'string',
            title: 'Title',
            example: 'Discovery call'
        },
        contentPlaintext: {
            type: 'string',
            title: 'Content (Plaintext)',
            example: 'Discussed pricing and next steps.'
        },
        contentMarkdown: {
            type: 'string',
            title: 'Content (Markdown)',
            example: 'Discussed **pricing** and next steps.'
        },
        meetingId: {
            type: 'string',
            title: 'Meeting ID',
            example: '5e5b8d4a-27f4-4a8c-a3f5-0d1f1c1e2b3a'
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

// The notes endpoint returns at most 50 notes per page.
const PAGE_SIZE = 50;

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { objectId, recordId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Notes', value: 'result' });
        }

        if (recordId && !objectId) {
            throw new context.CancelError('Parent Object is required when Parent Record ID is set!');
        }

        const params = { limit: PAGE_SIZE, offset: 0 };
        if (objectId) params.parent_object = objectId;
        if (recordId) params.parent_record_id = recordId;

        const records = [];
        while (records.length < lib.MAX_ITEMS) {
            const data = await lib.apiRequest(context, { path: '/v2/notes', params: { ...params } });
            const page = data.data || [];
            records.push(...page.map(lib.mapNote));
            if (page.length < PAGE_SIZE) break;
            params.offset += PAGE_SIZE;
        }

        if (records.length === 0) {
            return context.sendJson({ objectId: objectId || '', recordId: recordId || '' }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: records.slice(0, lib.MAX_ITEMS) });
    }
};
