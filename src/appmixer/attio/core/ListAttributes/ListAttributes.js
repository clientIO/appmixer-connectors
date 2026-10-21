'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'apiSlug', 'title', 'type'],
    properties: {
        id: {
            type: 'string',
            title: 'Attribute ID',
            example: '41252299-f8c7-4b5e-99c9-4ff8321d2f96'
        },
        apiSlug: {
            type: 'string',
            title: 'API Slug',
            example: 'domains'
        },
        title: {
            type: 'string',
            title: 'Title',
            example: 'Domains'
        },
        description: {
            type: 'string',
            title: 'Description',
            example: 'Website domains of the company'
        },
        type: {
            type: 'string',
            title: 'Type',
            example: 'domain'
        },
        isSystemAttribute: {
            type: 'boolean',
            title: 'Is System Attribute',
            example: true
        },
        isWritable: {
            type: 'boolean',
            title: 'Is Writable',
            example: true
        },
        isRequired: {
            type: 'boolean',
            title: 'Is Required',
            example: false
        },
        isUnique: {
            type: 'boolean',
            title: 'Is Unique',
            example: true
        },
        isMultiselect: {
            type: 'boolean',
            title: 'Is Multiselect',
            example: true
        },
        isArchived: {
            type: 'boolean',
            title: 'Is Archived',
            example: false
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Attributes', value: 'result' });
        }

        const { objectId, showArchived } = context.messages.in.content;

        if (!objectId) {
            if (context.properties.isSource) {
                return context.sendJson({ result: [], count: 0 }, 'out');
            }
            throw new context.CancelError('Object is required!');
        }

        try {
            const params = showArchived ? { show_archived: true } : undefined;
            const data = context.properties.isSource
                ? await lib.apiGetCached(context, '/v2/objects/' + encodeURIComponent(objectId) + '/attributes', params)
                : await lib.apiRequest(context, { path: '/v2/objects/' + encodeURIComponent(objectId) + '/attributes', params: params });
            const records = (data.data || []).map(lib.mapAttribute);
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
        return items.map(item => ({ label: item.title + ' (' + item.apiSlug + ')', value: item.apiSlug }));
    },

    toUniqueSelectArray(msg) {
        const items = (msg && msg.result) || [];
        return items
            .filter(item => item.isUnique && !item.isArchived)
            .map(item => ({ label: item.title + ' (' + item.apiSlug + ')', value: item.apiSlug }));
    }
};
