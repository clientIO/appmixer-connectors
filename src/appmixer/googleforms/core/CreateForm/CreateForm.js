'use strict';

module.exports = {

    async receive(context) {
        const { title, documentTitle } = context.messages.in.content;
        
        if (!title) {
            throw new context.CancelError('Title is required');
        }

        const formData = {
            info: {
                title: title
            }
        };

        // Add document title if provided, otherwise it will default to the form title
        if (documentTitle) {
            formData.info.documentTitle = documentTitle;
        }

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://forms.googleapis.com/v1/forms',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: formData,
        });

        return context.sendJson(data, 'out');
    }
};