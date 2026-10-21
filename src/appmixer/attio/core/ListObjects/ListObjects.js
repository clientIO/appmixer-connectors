'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'createdAt'],
    properties: {
        id: {
            type: 'string',
            title: 'Object ID',
            example: '97052eb9-e65e-443f-a297-f2d9a4a7f795'
        },
        apiSlug: {
            type: 'string',
            title: 'API Slug',
            example: 'companies'
        },
        singularNoun: {
            type: 'string',
            title: 'Singular Noun',
            example: 'Company'
        },
        pluralNoun: {
            type: 'string',
            title: 'Plural Noun',
            example: 'Companies'
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
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Objects', value: 'result' });
        }

        try {
            const data = context.properties.isSource
                ? await lib.apiGetCached(context, '/v2/objects', undefined)
                : await lib.apiRequest(context, { path: '/v2/objects', params: undefined });
            const records = (data.data || []).map(lib.mapObject);
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
        return items.map(item => ({
            label: item.pluralNoun || item.apiSlug || item.id,
            value: item.apiSlug || item.id
        }));
    }
};
