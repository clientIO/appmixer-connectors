'use strict';

const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const { userId } = context.auth;
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
            quotaUser: userId,
            resource,
            fields: '*'
        });

        return context.sendJson({ googleDriveFileMetadata: response.data }, 'out');
    }
};
