
const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Id' },'name':{ 'type':'string','title':'Name' },'status':{ 'type':'string','title':'Status' },'subject':{ 'type':'string','title':'Subject' },'thumbnail_url':{ 'type':'string','title':'Thumbnail Url' },'created_at':{ 'type':'string','title':'Created At' },'updated_at':{ 'type':'string','title':'Updated At' },'estimated_completed_at':{ 'type':'null','title':'Estimated Completed At' } };

module.exports = {
    async receive(context) {

        const { search, status, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'models', value: 'models' });
        }

        // https://www.everart.ai/api/docs
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.everart.ai/v1/models',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'models' });
    }
};
