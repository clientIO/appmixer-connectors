'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId } = context.messages.in.content;

        const normalizedFileId = typeof fileId === 'string' ? fileId : fileId.id;

        await drive.files.delete({ fileId: normalizedFileId });
        return context.sendJson({ fileId: normalizedFileId }, 'out');
    }
};
