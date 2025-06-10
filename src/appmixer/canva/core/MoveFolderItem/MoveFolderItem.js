'use strict';

module.exports = {
    async receive(context) {

        const { itemId, toFolderId } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/folders/move-folder-item/#http-method-and-url-path
        const response = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/rest/v1/folders/move',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: {
                item_id: itemId,
                to_folder_id: toFolderId
            }
        });

        if (response.status === 204) {
            return context.sendJson({ itemId }, 'out');
        } else {
            throw new Error(`Failed to move item: ${response.status}`);
        }
    }
};
