'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const DEBUG = commons.isDebug(context);

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, destinationFolder, supportsAllDrives = true } = context.messages.in.content;

        let folderId;
        if (destinationFolder) {
            if (typeof destinationFolder === 'string') {
                folderId = destinationFolder;
            } else {
                folderId = destinationFolder.id;
            }
        }

        // Retrieve the existing parents to remove
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'parents',
            supportsAllDrives
        });

        // Move the file to the new folder
        const previousParents = file.data.parents
            .map(parent => parent?.id || parent)
            .join(',');

        const params = {
            fileId: fileId,
            addParents: folderId,
            removeParents: previousParents,
            fields: 'id, parents',
            supportsAllDrives
        };

        if (DEBUG) {
            await context.log({ stage: 'DEBUG', fileMetadata: file, request: params });
        }

        await drive.files.update(params);
        return context.sendJson({}, 'out');
    }
};
