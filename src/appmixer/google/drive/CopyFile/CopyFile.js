'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, fileName, folderLocation, supportsAllDrives = true } = context.messages.in.content;

        const resource = {
            name: fileName
        };

        let folderId;
        if (folderLocation) {
            if (typeof folderLocation === 'string') {
                folderId = folderLocation;
            } else {
                folderId = folderLocation.id;
            }
            resource.parents = [folderId];
        }

        const response = await drive.files.copy({
            fileId,
            resource,
            fields: 'id, name, mimeType, webViewLink, createdTime',
            supportsAllDrives
        });
        return context.sendJson({
            fileId: response.data.id,
            fileName: response.data.name,
            mimeType: response.data.mimeType,
            webViewLink: response.data.webViewLink,
            createdTime: response.data.createdTime
        }, 'out');
    }
};
