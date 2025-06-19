'use strict';

module.exports = {

    async receive(context) {
        const { formId, responseId } = context.messages.in.content;
        
        if (!formId) {
            throw new context.CancelError('Form ID is required');
        }
        
        if (!responseId) {
            throw new context.CancelError('Response ID is required');
        }
        
        try {
            const response = await context.httpRequest({
                method: 'GET',
                url: `https://forms.googleapis.com/v1/forms/${formId}/responses/${responseId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                },
                json: true
            });
            
            // Add the full response object to the output
            response.response = response;
            
            return context.sendJson(response, 'out');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Response not found');
            }
            throw new context.CancelError(error.message || 'Failed to retrieve response');
        }
    }
};