'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'apiSlug', 'name', 'parentObject'],
    properties: {
        id: {
            type: 'string',
            title: 'List ID',
            example: '33ebdbe9-e529-47c9-b894-0ba25e9c15c0'
        },
        apiSlug: {
            type: 'string',
            title: 'API Slug',
            example: 'sales_pipeline'
        },
        name: {
            type: 'string',
            title: 'Name',
            example: 'Sales Pipeline'
        },
        parentObject: {
            type: 'string',
            title: 'Parent Object',
            example: 'companies'
        },
        workspaceAccess: {
            type: 'string',
            title: 'Workspace Access',
            example: 'full-access'
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

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Lists', value: 'result' });
        }

        try {
            const data = context.properties.isSource
                ? await lib.apiGetCached(context, '/v2/lists', undefined)
                : await lib.apiRequest(context, { path: '/v2/lists', params: undefined });
            const records = (data.data || []).map(lib.mapList);
            return lib.sendArrayOutput({ context, outputType, records });
        } catch (err) {
            if (context.properties.isSource) {
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw err;
        }
    },

    toSelectArray(msg) {
        const items = (msg && msg.result) || [];
        return items.map(item => ({ label: item.name || item.apiSlug, value: item.apiSlug || item.id }));
    }
};
