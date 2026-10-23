'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'objectId', 'objectSlug', 'recordText'],
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
        objectSlug: {
            type: 'string',
            title: 'Object Slug',
            example: 'companies'
        },
        recordText: {
            type: 'string',
            title: 'Record Text',
            example: 'Acme Inc.'
        },
        recordImage: {
            type: 'string',
            title: 'Record Image',
            example: 'https://assets.attio.com/logos/acme.png'
        },
        emailAddresses: {
            type: 'array',
            title: 'Email Addresses',
            items: {
                type: 'string'
            },
            example: ['jane.doe@acme.com']
        },
        phoneNumbers: {
            type: 'array',
            title: 'Phone Numbers',
            items: {
                type: 'string'
            },
            example: ['+15558675309']
        },
        domains: {
            type: 'array',
            title: 'Domains',
            items: {
                type: 'string'
            },
            example: ['acme.com']
        }
    }
};

function mapSearchResult(item = {}) {
    const id = item.id || {};
    return {
        id: id.record_id,
        objectId: id.object_id,
        objectSlug: item.object_slug,
        recordText: item.record_text,
        recordImage: item.record_image,
        emailAddresses: item.email_addresses || [],
        phoneNumbers: item.phone_numbers || [],
        domains: item.domains || []
    };
}

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { query, objects, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Records', value: 'result' });
        }

        const objectList = lib.splitList(objects);
        if (objectList.length === 0) {
            throw new context.CancelError('Objects is required!');
        }

        const data = await lib.apiRequest(context, {
            method: 'POST',
            path: '/v2/objects/records/search',
            data: {
                query: query || '',
                objects: objectList,
                limit: 25,
                request_as: { type: 'workspace' }
            }
        });
        const records = (data.data || []).map(mapSearchResult);

        if (records.length === 0) {
            return context.sendJson({ query: query || '' }, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
