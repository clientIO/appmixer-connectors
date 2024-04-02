'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const { fileId, customFileName, supportsAllDrives = true } = context.messages.in.content;

        const [{ data: metadata }, { data: stream }] = await Promise.all([
            drive.files.get({
                fileId: fileId,
                fields: 'id,name,mimeType,webViewLink,createdTime',
                supportsAllDrives
            }),
            drive.files.get({
                fileId: fileId,
                alt: 'media',
                supportsAllDrives
            }, { responseType: 'stream' })
        ]);

        const filename = customFileName || metadata.name;

        const file = await context.saveFileStream(filename, stream);
        return context.sendJson(file, 'out');
    }
};
