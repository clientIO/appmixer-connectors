
const lib = require('../lib.generated');
const schema = { 'presentationId': { 'type': 'string', 'title': 'Presentation Id' }, 'title': { 'type': 'string', 'title': 'Title' } };

module.exports = {
    async receive(context) {
        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Presentations', value: 'presentations' });
        }

        // https://developers.google.com/slides/api/reference/rest/v1/presentations
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://slides.googleapis.com/v1/presentations',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'presentations' });
    }
};
