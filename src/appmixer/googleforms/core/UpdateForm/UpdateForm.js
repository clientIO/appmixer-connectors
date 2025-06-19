'use strict';

module.exports = {

    async receive(context) {
        const { formId, title, description, documentTitle } = context.messages.in.content;
        
        if (!formId) {
            throw new context.CancelError('Form ID is required');
        }
        
        // Build the requests array for batch update
        const requests = [];
        const updatedFields = [];
        
        if (title) {
            requests.push({
                updateFormInfo: {
                    info: {
                        title: title
                    },
                    updateMask: 'title'
                }
            });
            updatedFields.push('title');
        }
        
        if (description) {
            requests.push({
                updateFormInfo: {
                    info: {
                        description: description
                    },
                    updateMask: 'description'
                }
            });
            updatedFields.push('description');
        }
        
        if (documentTitle) {
            requests.push({
                updateFormInfo: {
                    info: {
                        documentTitle: documentTitle
                    },
                    updateMask: 'documentTitle'
                }
            });
            updatedFields.push('documentTitle');
        }
        
        if (requests.length === 0) {
            throw new context.CancelError('At least one field to update must be provided');
        }
        
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
                },
                json: true
            });
            
            return context.sendJson({
                success: true,
                formId: formId,
                message: 'Form successfully updated',
                updatedFields: updatedFields
            }, 'out');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Form not found');
            }
            throw new context.CancelError(error.message || 'Failed to update form');
        }
    }
};