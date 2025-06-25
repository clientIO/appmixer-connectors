'use strict';


module.exports = {
    async receive(context) {

        const { templateId, newDocumentName, replacements, imageReplacements } = context.messages.in.content;

        // First, copy the template document
        const copyData = {
            name: newDocumentName || `Copy of Template`
        };

        // https://developers.google.com/drive/api/v3/reference/files/copy
        const { data: copiedDoc } = await context.httpRequest({
            method: 'POST',
            url: `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: copyData
        });

        // If replacements are provided, apply them
        if (replacements && typeof replacements === 'object') {
            const requests = [];

            for (const [oldText, newText] of Object.entries(replacements)) {
                requests.push({
                    replaceAllText: {
                        containsText: {
                            text: oldText,
                            matchCase: false
                        },
                        replaceText: newText
                    }
                });
            }

            if (requests.length > 0) {
                await context.httpRequest({
                    method: 'POST',
                    url: `https://docs.googleapis.com/v1/documents/${copiedDoc.id}:batchUpdate`,
                    headers: {
                        'Authorization': `Bearer ${context.auth.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    data: { requests }
                });
            }
        }

        return context.sendJson({
            id: copiedDoc.id,
            name: copiedDoc.name
        }, 'out');
    }
};
