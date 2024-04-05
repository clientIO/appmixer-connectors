'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const { userId } = context.auth;
        let { folderName, folderLocation, useExisting } = context.messages.in.content;
        const folderNameEscaped = commons.escapeFolderName(folderName);
        const resource = {
            name: folderNameEscaped,
            mimeType: 'application/vnd.google-apps.folder'
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

        if (useExisting) {
            const query = `name='${folderNameEscaped}' and mimeType='application/vnd.google-apps.folder' and parents in '${folderLocation ? folderId : 'root'}' and trashed=false`;
            const { data } = await drive.files.list({
                q: query
            });
            await context.log({ query, data });
            const { files = [] } = data;
            if (files.length > 0) {
                const existingFolder = files[0];
                return context.sendJson({
                    folderId: existingFolder.id,
                    folderName: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                    webViewLink: existingFolder.webViewLink,
                    createdTime: existingFolder.createdTime
                }, 'out');
            }
        }

        const response = await drive.files.create({
            quotaUser: userId,
            resource,
            fields: 'id, name, mimeType, webViewLink, createdTime'
        });

        return context.sendJson({
            folderId: response.data.id,
            folderName: response.data.name,
            mimeType: response.data.mimeType,
            webViewLink: response.data.webViewLink,
            createdTime: response.data.createdTime
        }, 'out');
    }
};
