'use strict';
const { google } = require('googleapis');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        if (!fileId) {
            throw new context.CancelError('File ID is required!');
        }
        const normalizedFileId = typeof fileId === 'string' ? fileId : fileId.id;

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.delete({ fileId: normalizedFileId });

        return context.sendJson({}, 'out');
    }
};
