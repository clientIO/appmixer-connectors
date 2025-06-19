const lib = require('../../lib.generated');
const schema = {
    'id': { 'type': 'string', 'title': 'Model Id' },
    'name': { 'type': 'string', 'title': 'Name' },
    'status': { 'type': 'string', 'title': 'Status' },
    'subject': { 'type': 'string', 'title': 'Subject' },
    'created_at': { 'type': 'string', 'title': 'Created At' },
    'updated_at': { 'type': 'string', 'title': 'Updated At' },
    'estimated_completed_at': { 'type': 'string', 'title': 'Estimated Completed At' },
    'thumbnail_url': { 'type': 'string', 'title': 'Thumbnail Url' }
};

module.exports = {
    async receive(context) {
        const { search, status, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Models', value: 'result' });
        }

        const queryParams = {};
        if (search) {
            queryParams.search = encodeURIComponent(search);
        }
        if (status) {
            queryParams.status = status;
        }

        // https://www.everart.ai/api/docs/#/Models/get_models_get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.everart.ai/v1/models',
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            },
            params: queryParams
        });

        if (!data.models.length) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data.models, outputType });
    }
};
