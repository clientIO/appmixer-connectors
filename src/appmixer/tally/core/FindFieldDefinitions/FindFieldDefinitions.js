'use strict';

module.exports = {
    async receive(context) {

        const { formId } = context.messages.in.content;

        // https://developers.tally.so/api-reference/endpoint/forms/get
        const call = {
            method: 'GET',
            url: `https://api.tally.so/forms/${formId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.apiKey}`
            }
        }
        console.log({call});
        const { data } = await context.httpRequest(call);

        return context.sendJson(data, 'out');
    }
};
