'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, supportsAllDrives = true } = context.messages.in.content;

        await drive.files.delete({ fileId, supportsAllDrives });
        return context.sendJson({ fileId }, 'out');
    }
};
