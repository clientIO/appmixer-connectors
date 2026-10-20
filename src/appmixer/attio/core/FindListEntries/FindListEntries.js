'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'listId', 'parentRecordId', 'parentObject'],
    properties: {
        id: {
            type: 'string',
            title: 'Entry ID',
            example: '2e6e29ea-c4e0-4f44-842d-78a891f8c156'
        },
        listId: {
            type: 'string',
            title: 'List ID',
            example: '33ebdbe9-e529-47c9-b894-0ba25e9c15c0'
        },
        workspaceId: {
            type: 'string',
            title: 'Workspace ID',
            example: '14beef7a-99f7-4534-a87e-70b564330a4c'
        },
        parentRecordId: {
            type: 'string',
            title: 'Parent Record ID',
            example: 'bf071e1f-6035-429d-b874-d83ea64ea13b'
        },
        parentObject: {
            type: 'string',
            title: 'Parent Object',
            example: 'companies'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            title: 'Created At',
            example: '2026-10-20T08:00:00.000000000Z'
        },
        entryValues: {
            type: 'object',
            title: 'Entry Values',
            example: {
                stage: 'In Progress'
            }
        },
        rawEntryValues: {
            type: 'object',
            title: 'Raw Entry Values',
            example: {
                stage: [
                    {
                        active_until: null,
                        status: {
                            title: 'In Progress'
                        }
                    }
                ]
            }
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { listId, parentRecordId, filter, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Entries', value: 'result' });
        }

        if (!listId) {
            throw new context.CancelError('List is required!');
        }

        const conditions = [];
        const parsedFilter = lib.parseJsonObject(context, filter, 'Filter');
        if (parsedFilter) conditions.push(parsedFilter);
        if (parentRecordId) {
            // Documented path filter: [[<list slug>, 'parent_record'], [<parent object>, 'record_id']].
            const { data: list } = await lib.apiRequest(context, { path: '/v2/lists/' + encodeURIComponent(listId) });
            const parentObject = Array.isArray(list.parent_object) ? list.parent_object[0] : list.parent_object;
            conditions.push({
                path: [[list.api_slug, 'parent_record'], [parentObject, 'record_id']],
                constraints: { value: parentRecordId }
            });
        }

        const body = { limit: lib.MAX_ITEMS };
        if (conditions.length === 1) body.filter = conditions[0];
        if (conditions.length > 1) body.filter = { $and: conditions };

        const data = await lib.apiRequest(context, {
            method: 'POST',
            path: '/v2/lists/' + encodeURIComponent(listId) + '/entries/query',
            data: body
        });
        const records = (data.data || []).map(lib.mapEntry);

        if (records.length === 0) {
            return context.sendJson({ filter: body.filter || {} }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
