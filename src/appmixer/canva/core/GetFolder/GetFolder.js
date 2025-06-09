'use strict';

module.exports = {
    async receive(context) {

        const { folderId } = context.messages.in.content;

        // https://www.canva.dev/docs/connect/api-reference/folders/get-folder/
        const response = await context.httpRequest({
            method: 'GET',
            url: `https://api.canva.com/rest/v1/folders/${folderId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(response.data.folder, 'out');
    }
};
