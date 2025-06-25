'use strict';

module.exports = {
    async receive(context) {

        const { documentId } = context.messages.in.content;

        // Get document content using Google Docs API
        // https://developers.google.com/docs/api/reference/rest/v1/documents/get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://docs.googleapis.com/v1/documents/${documentId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson({
            documentId: data.documentId,
            title: data.title,
            body: data.body,
            content: data
        }, 'out');
    }
};
