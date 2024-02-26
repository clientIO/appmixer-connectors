'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        let { fileId, fileName, folder } = context.messages.in.content;

        const { accessToken, profileInfo } = context.auth;
        const file = await context.getFileInfo(fileId);
        const fileStream = await context.getFileReadStream(fileId);

        let folderId = 'root';
        if (folder) {
            if (typeof folder === 'string') {
                folderId = `${folder}`;
            } else {
                folderId = `${folder.id}`;
            }
        }

        if (!fileName) {
            fileName = file.filename;
        }

        const upload = await commons.formatError(() => {
            return oneDriveAPI.items.uploadSession({
                accessToken,
                filename: fileName,
                fileSize: file.length,
                readableStream: fileStream,
                parentId: folderId
            });
        }, `The selected folder could not be found in your OneDrive account (${profileInfo.userPrincipalName})`);

        return context.sendJson(upload, 'out');
    }
};
