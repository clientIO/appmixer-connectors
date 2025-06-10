
'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { formId } = context.messages.in.content;

        if (!formId) {
            throw new Error('Form ID is required');
        }

        try {
            // Note: Google Forms API doesn't have a direct delete endpoint.
            // Forms can only be moved to trash via Google Drive API
            // This would require Drive API scope and different implementation
            
            // For now, we'll return an informative error
            throw new Error(
                'Direct form deletion is not supported by Google Forms API. ' +
                'To delete a form, use Google Drive API to move the form file to trash. ' +
                'The form ID corresponds to the file ID in Google Drive.'
            );

            // If Drive API scope is available, the implementation would be:
            /*
            const { data } = await context.httpRequest({
                method: 'PATCH',
                url: `https://www.googleapis.com/drive/v3/files/${formId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiToken}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    trashed: true
                }
            });

            return context.sendJson({
                success: true,
                formId: formId,
                message: 'Form moved to trash successfully'
            }, 'out');
            */
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Form with ID '${formId}' not found`);
            }
            throw new Error(`Failed to delete form: ${error.response?.data?.error?.message || error.message}`);
        }
    }
};
