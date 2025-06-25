'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { documentId, text, paragraphText, index, insertionIndex } = context.messages.in.content;
        
        // Support both text/paragraphText and index/insertionIndex for compatibility
        const textToInsert = text || paragraphText;
        const indexToUse = index !== undefined ? index : insertionIndex;

        let location;
        if (indexToUse !== undefined && indexToUse !== null) {
            // Use specific index if provided, ensure it's at least 1
            location = { index: Math.max(1, indexToUse) };
        } else {
            // Use end of segment to append text
            location = { endOfSegmentLocation: { segmentId: "" } };
        }

        const requests = [{
            insertText: {
                location: location,
                text: textToInsert + '\n' // Add newline to create a paragraph
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

        return context.sendJson({
            success: true,
            documentId: documentId,
            insertedText: textToInsert,
            replies: data.replies
        }, 'out');
    }
};
