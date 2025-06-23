'use strict';

module.exports = {

    async receive(context) {
        const { formId } = context.messages.in.content;
        
        if (!formId) {
            throw new context.CancelError('Form ID is required');
        }
        
        try {
            // Google Forms API doesn't have a direct delete endpoint
            // We need to use Google Drive API to move the form to trash
            await context.httpRequest({
                method: 'PATCH',
                url: `https://www.googleapis.com/drive/v3/files/${formId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    trashed: true
                }
            });
            
            return context.sendJson({
                success: true,
                formId: formId,
                message: 'Form successfully moved to trash'
            }, 'out');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                throw new context.CancelError('Form not found');
            }
            throw new context.CancelError(error.message || 'Failed to delete form');
        }
    }
};