'use strict';

module.exports = {
    async receive(context) {

        const { documentId, oldText, newText } = context.messages.in.content;

        const requests = [{
            replaceAllText: {
                containsText: {
                    text: oldText,
                    matchCase: false
                },
                replaceText: newText
            }
        }];

        // https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: { requests }
        });

        // Extract replacement count from the response
        let replacements = 0;
        if (data.replies && data.replies[0] && data.replies[0].replaceAllText) {
            replacements = data.replies[0].replaceAllText.occurrencesChanged || 0;
        }

        return context.sendJson({
            documentId,
            replacements,
            oldText,
            newText
        }, 'out');
    }
};
