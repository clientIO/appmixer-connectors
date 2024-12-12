'use strict';

module.exports = {

    async receive(context) {

        const { driveId, itemId, itemPath, newName, folderId } = context.messages.in.content;
        const { accessToken } = context.auth;

        let url = '';
        if (itemId) {
            url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`;
        } else {
            url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${itemPath}`;
        }

        const body = {
            parentReference: {
                id: folderId
            },
            name: newName
        };

        const { data } = await context.httpRequest({
            method: 'PATCH',
            url,
            headers: {
                'Authorization': 'Bearer ' + accessToken
            },
            data: body
        });

        return await context.sendJson(data, 'out');
    }
};
