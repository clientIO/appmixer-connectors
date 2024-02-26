'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileId, destinationFolder } = context.messages.in.content;

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
            fields: 'parents'
        });

        // Move the file to the new folder
        const previousParents = file.data.parents.map(function(parent) {
            return parent.id;
        }).join(',');

        const files = await drive.files.update({
            fileId: fileId,
            addParents: folderId,
            removeParents: previousParents,
            fields: 'id, parents'
        });
        return context.sendJson({}, 'out');
    }
};
