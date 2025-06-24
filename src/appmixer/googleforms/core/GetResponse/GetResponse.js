'use strict';

module.exports = {

    async receive(context) {
        const { formId, responseId } = context.messages.in.content;

        try {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://forms.googleapis.com/v1/forms/${formId}/responses/${responseId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });

            // Add the full response object to the output
            const result = {
                ...data,
                response: data
            };

            return context.sendJson(result, 'out');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Response not found');
            }
            throw error;
        }
    }
};