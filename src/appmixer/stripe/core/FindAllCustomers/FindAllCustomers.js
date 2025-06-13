
const lib = require('../../lib.generated');
const schema = { 'id': { 'type': 'string', 'title': 'Id' }, 'email': { 'type': 'string', 'title': 'Email' } };

module.exports = {
    async receive(context) {
        const { email, test_clock, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'data', value: 'data' });
        }

        const queryParams = { email, test_clock };

        // https://stripe.com/docs/api/customers/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.stripe.com/v1/customers',
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`
            },
            params: queryParams
        });

        context.log({ step: 'response', data });

        return lib.sendArrayOutput({ context, records: data.data, outputType, arrayPropertyValue: 'data' });
    }
};
