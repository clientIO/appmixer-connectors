'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { title, content } = context.messages.in.content;

        const requestBody = {
            title: title || 'Untitled Document'
        };

        // https://developers.google.com/docs/api/reference/rest/v1/documents/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://docs.googleapis.com/v1/documents',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: requestBody
        });

        // If content is provided, add it to the document
        if (content) {
            const requests = [{
                insertText: {
                    location: {
                        index: 1
                    },
                    text: content
                }
            }];

            await context.httpRequest({
                method: 'POST',
                url: `https://docs.googleapis.com/v1/documents/${data.documentId}:batchUpdate`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data: { requests }
            });
        }

        return context.sendJson({
            documentId: data.documentId,
            title: data.title
        }, 'out');
    }
};
