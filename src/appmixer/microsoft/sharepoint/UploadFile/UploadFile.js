'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        let { driveId, fileId, fileName, parentId, parentPath } = context.messages.in.content;

        const { accessToken, profileInfo } = context.auth;
        const file = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);


        if (!fileName) {
            fileName = file.filename;
        }

        const upload = await commons.formatError(() => {
            return oneDriveAPI.items.uploadSession({
                accessToken,
                drive: 'drive',
                driveId,
                filename: fileName,
                fileSize: file.length,
                readableStream: fileStream,
                parentId,
                parentPath
            });
        }, `The selected folder (${parentId || parentPath}) could not be found in your SharePoint account (${profileInfo.userPrincipalName})`);

        return context.sendJson(upload, 'out');
    }
};
