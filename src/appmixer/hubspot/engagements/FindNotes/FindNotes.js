const Hubspot = require('../../Hubspot');

const lib = require('../../lib');
const schema = {
    'id': { 'type': 'string', 'title': 'Id' },
    'properties': {
        'type': 'object',
        'properties': {
            'hs_createdate': { 'type': 'string', 'title': 'Properties.Hs Create Date' },
            'hs_lastmodifieddate': { 'type': 'string', 'title': 'Properties.Hs Last Modified Date' },
            'hs_object_id': { 'type': 'string', 'title': 'Properties.Hs Object Id' },
            'hs_note_body': { 'type': 'string', 'title': 'Properties.Note Body' },
            'hubspot_owner_id': { 'type': 'string', 'title': 'Properties.Owner Id' }
        },
        'title': 'Properties'
    },
    'createdAt': { 'type': 'string', 'title': 'Created At' },
    'updatedAt': { 'type': 'string', 'title': 'Updated At' },
    'archived': { 'type': 'boolean', 'title': 'Archived' }
};

module.exports = {
    async receive(context) {
        const {
            query,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'results', value: 'results' });
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
