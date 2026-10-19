const Hubspot = require('../../Hubspot');

const lib = require('../../lib');
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'properties', 'createdAt', 'updatedAt'],
    properties: {
        'id': { 'type': 'string', 'title': 'Id', 'example': '87654321' },
        'properties': {
            'type': 'object',
            'properties': {
                'hs_createdate': { 'type': 'string', 'title': 'Properties.Hs Create Date', 'example': '2026-07-24T12:00:00.000Z' },
                'hs_lastmodifieddate': { 'type': 'string', 'title': 'Properties.Hs Last Modified Date', 'example': '2026-07-24T12:05:00.000Z' },
                'hs_object_id': { 'type': 'string', 'title': 'Properties.Hs Object Id', 'example': '87654321' },
                'hs_note_body': { 'type': 'string', 'title': 'Properties.Note Body', 'example': 'Follow-up call scheduled for next week.' },
                'hubspot_owner_id': { 'type': 'string', 'title': 'Properties.Owner Id', 'example': '1246609099' }
            },
            'title': 'Properties'
        },
        'createdAt': { 'type': 'string', 'title': 'Created At', 'example': '2026-07-24T12:00:00.000Z' },
        'updatedAt': { 'type': 'string', 'title': 'Updated At', 'example': '2026-07-24T12:05:00.000Z' },
        'archived': { 'type': 'boolean', 'title': 'Archived', 'example': false }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {
        const {
            query,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'results', value: 'results' });
        }

        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            query,
            limit: 200,
            properties: ['hs_note_body', 'hubspot_owner_id']
        };

        const { data } = await hs.call(
            'post',
            '/crm/v3/objects/notes/search',
            payload
        );

        if (data.results.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data.results, outputType, arrayPropertyValue: 'results' });
    }
};
