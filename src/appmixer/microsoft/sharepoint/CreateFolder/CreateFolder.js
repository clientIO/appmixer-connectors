'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        const { driveId, parentId, parentPath, name } = context.messages.in.content;
        const { accessToken, profileInfo } = context.auth;

        const result = await commons.formatError(async () => {
            return oneDriveAPI.items.createFolder({
                accessToken,
                name,
                itemPath: parentPath,
                rootItemId: parentId,
                driveId,
                drive: 'drive'
            });
        }, `Failed to create the folder named "${name}" in your SharePoint account (${profileInfo.userPrincipalName}).`);

        return context.sendJson(result, 'out');
    }
};
