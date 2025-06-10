
'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { formId } = context.messages.in.content;

        if (!formId) {
            throw new Error('Form ID is required');
        }

        try {
            // https://developers.google.com/forms/api/reference/rest/v1/forms/get
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://forms.googleapis.com/v1/forms/${formId}`,
                headers: {
                    'Authorization': `Bearer ${context.auth.apiToken}`
                }
            });

            // Transform the response to a cleaner format
            const output = {
                formId: data.formId,
                documentTitle: data.info?.title,
                description: data.info?.description,
                items: data.items || [],
                settings: data.settings,
                responderUri: data.responderUri,
                linkedSheetId: data.linkedSheetId,
                revisionId: data.revisionId
            };

            return context.sendJson(output, 'out');
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Form with ID '${formId}' not found`);
            }
            throw new Error(`Failed to get form: ${error.response?.data?.error?.message || error.message}`);
        }
    }
};
