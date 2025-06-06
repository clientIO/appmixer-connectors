
const lib = require('../../lib.generated');
const schema = {"upload_token":{"type":"string","title":"Upload Token"},"upload_url":{"type":"string","title":"Upload Url"},"file_url":{"type":"string","title":"File Url"},"id":{"type":"string","title":"Id"}}

module.exports = {
    async receive(context) {        

        const { images|filename, images|content_type, images|id, outputType } = context.messages.in.content;

if (context.properties.generateOutputPortOptions) {
        return lib.getOutputPortOptions(context, outputType, schema, { label: 'image_uploads', value: 'image_uploads' });
    }


        // https://www.everart.ai/api/docs
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.everart.ai/v1/images/uploads',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });
    

return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'image_uploads' })
    }
};
