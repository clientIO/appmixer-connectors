'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {

        const { documentId, imageUrl, index, width, height } = context.messages.in.content;

        // For images, it's safer to use endOfSegmentLocation to append to the end of the document
        // rather than trying to specify an exact index which can cause 400 errors
        const location = {
            endOfSegmentLocation: { segmentId: "" }
        };

        const imageRequest = {
            insertInlineImage: {
                location: location,
                uri: imageUrl
            }
        };

        // Add optional dimensions if provided
        if (width || height) {
            imageRequest.insertInlineImage.objectSize = {};
            if (width) {
                imageRequest.insertInlineImage.objectSize.width = {
                    magnitude: width,
                    unit: 'PT'
                };
            }
            if (height) {
                imageRequest.insertInlineImage.objectSize.height = {
                    magnitude: height,
                    unit: 'PT'
                };
            }
        }

        const requests = [imageRequest];

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
            imageUrl: imageUrl,
            replies: data.replies
        }, 'out');
    }
};
