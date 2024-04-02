'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const { fileId, supportsAllDrives = true } = context.messages.in.content;

        const [{ data: metadata }, { data: content }] = await Promise.all([
            drive.files.get({
                fileId: fileId,
                fields: 'id,name,mimeType,webViewLink,createdTime',
                supportsAllDrives
            }),
            drive.files.get({
                fileId: fileId,
                alt: 'media',
                supportsAllDrives
            })
        ]);

        return context.sendJson({
            raw: content, // deprecated - do not return content to a output port,use the DownloadFile instead
            googleDriveFileId: metadata.id,
            fileName: metadata.name,
            mimeType: metadata.mimeType,
            webViewLink: metadata.webViewLink,
            createdTime: metadata.createdTime
        }, 'out');
    }
};
