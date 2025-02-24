'use strict';
const { google } = require('googleapis');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { folderName, folderLocation, useExisting } = context.messages.in.content;
        const escapedFolderName = lib.escapeSpecialCharacters(folderName);
        const resource = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };
        let folderId;
        if (folderLocation) {
            folderId = typeof folderLocation === 'string' ? folderLocation : folderLocation.id;
            resource.parents = [folderId];
        }

        if (useExisting) {
            const query = `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and parents in '${folderLocation ? folderId : 'root'}' and trashed=false`;
            const { data } = await drive.files.list({ q: query, fields: '*', pageSize: 1 });
            const { files = [] } = data;
            if (files.length > 0) {
                return context.sendJson({ googleDriveFileMetadata: files[0] }, 'out');
            }
        }

        const response = await drive.files.create({
            resource,
            fields: '*'
        });

        return context.sendJson({ googleDriveFileMetadata: response.data }, 'out');
    }
};
