'use strict';

const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, shortcutName, destinationFolder } = context.messages.in.content;


        let normalizedDestinationFolder;
        if (destinationFolder) {
            normalizedDestinationFolder = typeof destinationFolder === 'string' ? destinationFolder : destinationFolder.id;
        }
        const normalizedFileId = typeof fileId === 'string' ? fileId : fileId.id;

        const resource = {
            name: shortcutName,
            mimeType: 'application/vnd.google-apps.shortcut',
            shortcutDetails: {
                targetId: normalizedFileId
            }
        };

        if (destinationFolder) {
            resource.parents = [normalizedDestinationFolder];
        }

        const response = await drive.files.create({
            resource,
            fields: '*'
        });

        return context.sendJson({
            googleDriveFileId: normalizedFileId,
            googleDriveFileMetadata: response.data
        }, 'out');
    }
};
