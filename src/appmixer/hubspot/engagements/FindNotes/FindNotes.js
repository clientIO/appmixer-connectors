const lib = require('../../lib.generated');
const Hubspot = require('../../Hubspot');
const schema = {
    'id': { 'type': 'string', 'title': 'Id' },
    'properties': {
        'type': 'object',
        'properties': {
            'hs_note_body': { 'type': 'string', 'title': 'Properties.Hs Note Body' },
            'hs_createdate': { 'type': 'string', 'title': 'Properties.Hs Createdate' }
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

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            query, limit: 200
        };

        const { data } = await hs.call(
            'post',
            '/crm/v3/objects/notes/search',
            payload
        );

        console.log(data);

        return lib.sendArrayOutput({ context, records: data.results, outputType, arrayPropertyValue: 'results' });
    }

};
