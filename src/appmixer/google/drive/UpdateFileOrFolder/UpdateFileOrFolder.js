'use strict';

const { google } = require('googleapis');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, name, description, starred } = context.messages.in.content;


        const resource = {};

        if (name) {
            resource.name = name;
        }
        if (description) {
            resource.description = description;
        }
        if (typeof starred === 'boolean') {
            resource.starred = starred;
        }
        const response = await drive.files.update({
            fileId: typeof fileId === 'string' ? fileId : fileId.id,
            resource,
            fields: '*'
        });

        return context.sendJson({ googleDriveFileMetadata: response.data }, 'out');
    }
};
