'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, destinationFolder } = context.messages.in.content;

        const normalizedFileId = typeof fileId === 'string' ? fileId : fileId.id;

        let folderId;
        if (destinationFolder) {
            folderId = typeof destinationFolder === 'string' ? destinationFolder : destinationFolder.id;
        }

        // Retrieve the existing parents to remove
        const file = await drive.files.get({
            fileId: normalizedFileId,
            fields: 'parents'
        });

        // Move the file to the new folder
        const previousParents = file.data.parents
            .map(parent => parent?.id || parent)
            .join(',');

        const params = {
            fileId: normalizedFileId,
            addParents: folderId,
            removeParents: previousParents,
            fields: '*'
        };

        const { data: googleDriveFileMetadata } = await drive.files.update(params);
        return context.sendJson({ googleDriveFileMetadata }, 'out');
    }
};
