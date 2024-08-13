'use strict';
const mime = require('mime-types');
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { fileName, folder, replace, convertToDocument, content } = context.messages.in.content;

        let contentType;

        contentType = mime.lookup(fileName) || 'text/plain';

        const resource = { name: fileName };

        if (convertToDocument && contentType in conversionTypes) {
            const conversionType = conversionTypes[contentType];
            resource.mimeType = conversionType;
        }

        let folderId;
        if (folder) {
            folderId = typeof folder === 'string' ? folder : folder.id;
            resource.parents = [folderId];
        }

        let response;

        if (replace) {
            const normalizedFileName = commons.escapeSpecialCharacters(fileName);
            const query = `name='${normalizedFileName}' and parents in '${folder ? folderId : 'root'}' and trashed=false`;
            const { data } = await drive.files.list({
                q: query
            });
            const { files = [] } = data;
            if (files.length > 0) {
                const file = files[0];
                response = await drive.files.update({
                    fileId: file.id,
                    media: {
                        mimeType: contentType,
                        body: content
                    },
                    fields: '*'
                });
            } else {
                // If no file exists, just create new file
                response = await drive.files.create({
                    resource,
                    media: {
                        mimeType: contentType,
                        body: content
                    },
                    fields: '*'
                });
            }
        } else {
            response = await drive.files.create({
                resource,
                media: {
                    mimeType: contentType,
                    body: content
                },
                fields: '*'
            });
        }

        return context.sendJson({
            content,
            googleDriveFileMetadata: response.data
        }, 'out');
    }
};

const conversionTypes = {
    'text/plain' : 'application/vnd.google-apps.document',  // txt
    'text/csv' : 'application/vnd.google-apps.spreadsheet',  // csv
    'text/tab-separated-values': 'application/vnd.google-apps.spreadsheet'  // tsv
};
