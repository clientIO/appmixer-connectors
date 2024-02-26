'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        const { driveId, siteId, groupId, userId, drive, itemId, itemPath } = context.messages.in.content;

        const { accessToken, profileInfo } = context.auth;

        const getFile = await commons.formatError(async () => {
            return oneDriveAPI.items.getMetadata({
                accessToken,
                itemId,
                itemPath,
                drive,
                driveId: driveId || siteId || groupId || userId
            });
        }, `Failed to get the file "${itemId || itemPath }" from your OneDrive account (${profileInfo.userPrincipalName}).`);

        return context.sendJson(getFile, 'out');
    }
};
