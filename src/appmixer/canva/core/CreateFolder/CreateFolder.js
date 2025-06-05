'use strict';

module.exports = {
    async receive(context) {
        const { name, parentFolderId = 'root' } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/folders/create-folder/#http-method-and-url-path
        const response = await context.httpRequest({
            method: 'POST',
            url: 'https://api.canva.com/rest/v1/folders',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: {
                name,
                parent_folder_id: parentFolderId
            }
        });

        return context.sendJson(response.data.folder, 'out');
    }
};
