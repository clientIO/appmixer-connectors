'use strict';

// Shared by tick() (production) and test() (Flow Test Mode): fetch a document by ID.
// https://developers.google.com/docs/api/reference/rest/v1/documents/get
async function fetchDocument(context, documentId) {

    const { data } = await context.httpRequest({
        method: 'GET',
        url: `https://docs.googleapis.com/v1/documents/${documentId}`,
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`
        }
    });

    return data;
}

// Shared record -> output mapping, so tick() and test() emit an identical shape.
function mapDocument(data) {

    return {
        documentId: data.documentId,
        title: data.title,
        revisionId: data.revisionId,
        updated_at: new Date().toISOString()
    };
}

module.exports = {

    async tick(context) {

        const { documentId } = context.properties;

        if (!documentId) {
            throw new context.CancelError('Document ID is required!');
        }

        const data = await fetchDocument(context, documentId);

        // Load previously known state
        const state = await context.loadState();
        const lastRevisionId = state.lastRevisionId || null;
        const currentRevisionId = data.revisionId;

        // Check if document has been updated
        if (lastRevisionId && lastRevisionId === currentRevisionId) {
            // No changes since last check
            await context.saveState({ lastRevisionId: currentRevisionId });
            return;
        }

        // Document has been updated or this is the first check
        const document = mapDocument(data);

        // Send update to output port
        await context.sendJson(document, 'out');

        // Save current state for next tick
        await context.saveState({ lastRevisionId: currentRevisionId });
    },

    // Flow Test Mode: emit one representative update using the SAME fetch + mapping path as
    // tick(), honoring the documentId property, but WITHOUT reading/writing revision state.
    async test(context) {

        const { documentId } = context.properties;

        if (!documentId) {
            throw new context.CancelError('Document ID is required!');
        }

        const data = await fetchDocument(context, documentId);
        if (!data || !data.documentId) {
            throw new Error('Document not found to use as test data.');
        }

        return context.sendJson(mapDocument(data), 'out');
    }
};
