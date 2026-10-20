'use strict';

const lib = require('../../lib');

const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'emailAddress', 'accessLevel'],
    properties: {
        id: {
            type: 'string',
            title: 'Workspace Member ID',
            example: '50cf242c-7fa3-4cad-87d0-75b1af71c57b'
        },
        firstName: {
            type: 'string',
            title: 'First Name',
            example: 'Jane'
        },
        lastName: {
            type: 'string',
            title: 'Last Name',
            example: 'Doe'
        },
        emailAddress: {
            type: 'string',
            title: 'Email Address',
            example: 'jane@acme.com'
        },
        accessLevel: {
            type: 'string',
            title: 'Access Level',
            example: 'admin'
        },
        avatarUrl: {
            type: 'string',
            title: 'Avatar URL',
            example: 'https://lh3.googleusercontent.com/a/photo.jpg'
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
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Workspace Members', value: 'result' });
        }

        try {
            const data = context.properties.isSource
                ? await lib.apiGetCached(context, '/v2/workspace_members', undefined)
                : await lib.apiRequest(context, { path: '/v2/workspace_members', params: undefined });
            const records = (data.data || []).map(lib.mapMember);
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
        return items.map(item => {
            const name = [item.firstName, item.lastName].filter(Boolean).join(' ');
            return { label: name ? name + ' (' + item.emailAddress + ')' : item.emailAddress, value: item.id };
        });
    }
};
