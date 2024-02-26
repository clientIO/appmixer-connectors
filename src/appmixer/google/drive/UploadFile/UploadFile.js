'use strict';
const mime = require('mime-types');
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const { userId } = context.auth;
        let { fileId, fileName: fileNameInput, folder, replace } = context.messages.in.content;

        let filename;
        let contentType;

        if (fileNameInput) {
            filename = fileNameInput;
            contentType = mime.lookup(filename);
        } else {
            const fileInfo = await context.getFileInfo(fileId);
            filename = fileInfo.filename;
            contentType = fileInfo.contentType || mime.lookup(filename);
        }

        const resource = { name: filename };
        let folderId;
        if (folder) {
            if (typeof folder === 'string') {
                folderId = folder;
            } else {
                folderId = folder.id;
            }

            resource.parents = [folderId];
        }

        const fileStream = await context.getFileReadStream(fileId);

        let response;

        if (replace) {
            const query = `name='${filename}' and parents in '${folder ? folderId : 'root'}' and trashed=false`;
            const { data } = await drive.files.list({
                q: query
            });
            const { files = [] } = data;
            if (files.length > 0) {
                const file = files[0];
                response = await drive.files.update({
                    fileId: file.id,
                    quotaUser: userId,
                    media: {
                        mimeType: contentType,
                        body: fileStream
                    },
                    fields: 'id, name, mimeType, webViewLink, createdTime'
                });
            } else {
                // If no file exists, just create new file
                response = await drive.files.create({
                    quotaUser: userId,
                    resource,
                    media: {
                        mimeType: contentType,
                        body: fileStream
                    },
                    fields: 'id, name, mimeType, webViewLink, createdTime'
                });
            }
        } else {
            response = await drive.files.create({
                quotaUser: userId,
                resource,
                media: {
                    mimeType: contentType,
                    body: fileStream
                },
                fields: 'id, name, mimeType, webViewLink, createdTime'
            });
        }

        return context.sendJson({
            fileId,
            googleDriveFileId: response.data.id,
            fileName: response.data.name,
            mimeType: response.data.mimeType,
            webViewLink: response.data.webViewLink,
            createdTime: response.data.createdTime
        }, 'out');
    }
};
