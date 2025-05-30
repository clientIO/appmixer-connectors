
const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'string','title':'Id' },'amount':{ 'type':'number','title':'Amount' } };

module.exports = {
    async receive(context) {
        const { payment_link_id, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        // https://stripe.com/docs/api/payment_links/line_items
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/payment_links/{payment_link_id}/line_items',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'data' });
    }
};
