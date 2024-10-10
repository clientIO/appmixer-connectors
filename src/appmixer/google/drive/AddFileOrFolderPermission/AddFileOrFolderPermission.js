'use strict';

const { google } = require('googleapis');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { googleDriveFileId, type, role, emailAddress } = context.messages.in.content;

        const resource = {
            role,
            type,
            emailAddress
        };

        const fileId = typeof googleDriveFileId === 'string' ? googleDriveFileId : googleDriveFileId.id;

        const response = await drive.permissions.create({
            fileId,
            resource,
            fields: '*'
        });

        return context.sendJson({
            permission: response.data,
            fileId
        }, 'out');
    }
};
