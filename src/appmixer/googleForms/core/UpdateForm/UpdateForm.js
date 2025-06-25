'use strict';

module.exports = {

    async receive(context) {
        const { formId, title, description } = context.messages.in.content;

        // Build the requests array for batch update
        const requests = [];
        const updatedFields = [];

        // Build the info object to update
        const infoToUpdate = {};
        const maskFields = [];

        if (title) {
            infoToUpdate.title = title;
            maskFields.push('title');
            updatedFields.push('title');
        }

        if (description) {
            infoToUpdate.description = description;
            maskFields.push('description');
            updatedFields.push('description');
        }

        // Create a single updateFormInfo request with all fields
        requests.push({
            updateFormInfo: {
                info: infoToUpdate,
                updateMask: maskFields.join(',')
            }
        });

        try {
            await context.httpRequest({
                method: 'POST',
                url: `https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    requests: requests
                }
            });

            return context.sendJson({ updatedFields }, 'out');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Form not found');
            }
            throw error;
        }
    }
};
