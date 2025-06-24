'use strict';

const lib = require('../../lib.generated');
module.exports = {

    async receive(context) {
        const { formId, filter, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Responses', value: 'responses' });
        }

        try {
            // Build URL with optional filter parameter
            const url = new URL(`https://forms.googleapis.com/v1/forms/${formId}/responses`);
            
            // Add filter parameter if provided
            if (filter && filter.trim()) {
                url.searchParams.append('filter', filter.trim());
            }

            const { data } = await context.httpRequest({
                method: 'GET',
                url: url.toString(),
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });

            // Add the full response object to the output
            console.log(JSON.stringify(data, null, 4));

            if (data.responses && data.responses.length === 0) {
                return context.sendJson({}, 'notFound');
            }

            return lib.sendArrayOutput({ context, records: data.responses, outputType });

        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Form not found or no responses available');
            }
            throw error;
        }
    }
};