'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'objectId', 'createdAt', 'values'],
    properties: {
        id: {
            type: 'string',
            title: 'Record ID',
            example: 'bf071e1f-6035-429d-b874-d83ea64ea13b'
        },
        objectId: {
            type: 'string',
            title: 'Object ID',
            example: '97052eb9-e65e-443f-a297-f2d9a4a7f795'
        },
        workspaceId: {
            type: 'string',
            title: 'Workspace ID',
            example: '14beef7a-99f7-4534-a87e-70b564330a4c'
        },
        createdAt: {
            type: 'string',
            format: 'date-time',
            title: 'Created At',
            example: '2026-10-20T08:00:00.000000000Z'
        },
        webUrl: {
            type: 'string',
            title: 'Web URL',
            example: 'https://app.attio.com/acme/company/bf071e1f-6035-429d-b874-d83ea64ea13b'
        },
        values: {
            type: 'object',
            title: 'Values',
            example: {
                name: 'Acme Inc.',
                domains: 'acme.com',
                description: 'Maker of fine widgets'
            }
        },
        rawValues: {
            type: 'object',
            title: 'Raw Values',
            example: {
                name: [
                    {
                        active_from: '2026-10-20T08:00:00.000000000Z',
                        active_until: null,
                        value: 'Acme Inc.'
                    }
                ],
                domains: [
                    {
                        active_from: '2026-10-20T08:00:00.000000000Z',
                        active_until: null,
                        value: 'acme.com'
                    }
                ],
                description: [
                    {
                        active_from: '2026-10-20T08:00:00.000000000Z',
                        active_until: null,
                        value: 'Maker of fine widgets'
                    }
                ]
            }
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { domain, name, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Companies', value: 'result' });
        }

        const conditions = [];
        if (domain) conditions.push({ domains: { domain: { $eq: domain } } });
        if (name) conditions.push({ name: { $contains: name } });
        const filter = conditions.length ? { $and: conditions } : undefined;

        const records = await lib.queryRecords(context, 'companies', { filter });

        if (records.length === 0) {
            return context.sendJson({ filter: filter || {} }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
