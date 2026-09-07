'use strict';

module.exports = {

    async receive(context) {

        const { folderId, parentId, name } = context.messages.in.content;

        // Validate required inputs
        if (!folderId) {
            throw new context.CancelError('Folder ID is required.');
        }

        if (!parentId) {
            throw new context.CancelError('Parent Folder ID is required.');
        }

        // Build request body
        const requestBody = {
            parent: {
                id: parentId
            }
        };

        // Add optional name if provided
        if (name) {
            requestBody.name = name;
        }

        // https://developer.box.com/reference/post-folders-id-copy/
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.box.com/2.0/folders/${folderId}/copy`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: requestBody
        });

        return context.sendJson(data, 'out');
    }
};
