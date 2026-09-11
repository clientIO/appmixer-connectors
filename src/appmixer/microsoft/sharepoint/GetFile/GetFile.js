'use strict';

module.exports = {

    async receive(context) {

        const { siteId, driveId, itemId, itemPath } = context.messages.in.content;

        const { accessToken } = context.auth;

        if (!siteId) {
            throw new context.CancelError('Site ID is required!');
        }
        if (!driveId) {
            throw new context.CancelError('Drive ID is required!');
        }
        if (!itemId && !itemPath) {
            throw new context.CancelError('Item ID or Item Path is required!');
        }

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
