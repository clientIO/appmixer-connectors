'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const {
            fileId
        } = context.messages.in.content;

        const { data: googleDriveFileMetadata } = await drive.files.get({
            fileId: fileId === 'string' ? fileId : fileId.id,
            fields: '*'
        });

        return context.sendJson({ googleDriveFileMetadata }, 'out');
    }
};
