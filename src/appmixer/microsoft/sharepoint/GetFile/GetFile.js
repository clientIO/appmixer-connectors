'use strict';

module.exports = {

    async receive(context) {

        const { driveId, itemId, itemPath } = context.messages.in.content;

        const { accessToken } = context.auth;

        let url = '';
        if (itemId) {
            url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}`;
        } else {
            url = `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${itemPath}`;
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url,
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        });

        return context.sendJson(data, 'out');
    }
};
