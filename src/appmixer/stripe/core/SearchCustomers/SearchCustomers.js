
const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Id' },'email':{ 'type':'string','title':'Email' } };

module.exports = {
    async receive(context) {
        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        // https://stripe.com/docs/api/customers/search
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/customers/search',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'data' });
    }
};
