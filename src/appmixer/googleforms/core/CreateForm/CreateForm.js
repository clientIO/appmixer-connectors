'use strict';

module.exports = {

    async receive(context) {
        const { title, documentTitle } = context.messages.in.content;

        const formData = {
            info: {
                title: title
            }
        };

        // Add document title if provided, otherwise it will default to the form title
        if (documentTitle) {
            formData.info.documentTitle = documentTitle;
        }

        const response = await context.httpRequest({
            method: 'POST',
            url: 'https://forms.googleapis.com/v1/forms',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: formData,
            json: true
        });

        // Add the full form object to the output
        response.form = response;

        console.log(response.data);
        return context.sendJson(response, 'out');
    }
};