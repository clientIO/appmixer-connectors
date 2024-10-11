'use strict';
const { google } = require('googleapis');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, fileName, folderLocation } = context.messages.in.content;

        const resource = {
            name: fileName
        };

        let folderId;
        if (folderLocation) {
            folderId = typeof folderLocation === 'string' ? folderLocation : folderLocation.id;
            resource.parents = [folderId];
        }

        const response = await drive.files.copy({
            fileId: typeof fileId === 'string' ? fileId : fileId.id,
            resource,
            fields: '*'
        });
        return context.sendJson({ googleDriveFileMetadata: response.data }, 'out');
    }
};
