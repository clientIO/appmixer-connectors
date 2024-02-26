'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        const {
            driveId,
            siteId,
            groupId,
            userId,
            drive,
            itemId,
            itemPath,
            newName,
            folderId
        } = context.messages.in.content;
        const { accessToken, profileInfo } = context.auth;

        const renameFile = await commons.formatError(async () => {
            return oneDriveAPI.items.update({
                accessToken,
                itemId,
                itemPath,
                drive,
                driveId: driveId || siteId || groupId || userId,
                toUpdate: {
                    name: newName,
                    parentReference: folderId && {
                        id: folderId
                    }
                }
            });
        }, `Failed to rename the file with ID "${itemId}" in your OneDrive account (${profileInfo.userPrincipalName}).`);

        return context.sendJson(renameFile, 'out');
    }
};
