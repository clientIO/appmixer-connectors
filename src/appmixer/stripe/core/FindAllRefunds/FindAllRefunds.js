
const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Id' },'amount':{ 'type':'number','title':'Amount' },'currency':{ 'type':'string','title':'Currency' } };

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        // https://stripe.com/docs/api/refunds/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/refunds',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'data' });
    }
};
