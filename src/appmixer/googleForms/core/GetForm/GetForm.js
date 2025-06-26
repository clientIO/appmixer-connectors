'use strict';

module.exports = {

    async receive(context) {
        const { formId } = context.messages.in.content;

        try {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://forms.googleapis.com/v1/forms/${formId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });

            return context.sendJson(data, 'out');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Form not found');
            }
            throw error;
        }
    }
};
