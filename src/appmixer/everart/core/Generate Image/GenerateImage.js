const lib = require('../../lib.generated');
const schema = {
    'id': { 'type': 'string', 'title': 'Id' },
    'model_id': { 'type': 'string', 'title': 'Model Id' },
    'status': { 'type': 'string', 'title': 'Status' },
    'image_url': { 'type': 'string', 'title': 'Image Url' },
    'type': { 'type': 'string', 'title': 'Type' },
    'created_at': { 'type': 'string', 'title': 'Created At' },
    'updated_at': { 'type': 'string', 'title': 'Updated At' }
};

module.exports = {
    async receive(context) {
        const {
            id,
            prompt,
            image,
            type,
            image_count,
            height,
            width,
            webhook_url,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'undefined', value: 'generations' });
        }

        // https://www.everart.ai/api/docs/#/Generations/post_models__id__generations_post
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.everart.ai/v1/models/${id}/generations`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            },
            json: { prompt, image, type, image_count, height, width, webhook_url }
        });
        const records = data.generations;

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'generations' });
    }
};
