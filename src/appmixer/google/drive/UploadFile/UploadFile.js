'use strict';
const mime = require('mime-types');
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const { userId } = context.auth;
        let { fileId, fileName: fileNameInput, folder, replace, convertToDocument } = context.messages.in.content;

        let filename;
        let contentType;

        if (fileNameInput) {
            filename = fileNameInput;
            contentType = mime.lookup(filename);
        } else {
            const fileInfo = await context.getFileInfo(fileId);
            filename = fileInfo.filename;
            contentType = fileInfo.contentType || mime.lookup(filename);
        }

        const resource = { name: filename };

        if (convertToDocument && contentType in conversionTypes) {
            const conversionType = conversionTypes[contentType];
            resource.mimeType = conversionType;
        }

        let folderId;
        if (folder) {
            if (typeof folder === 'string') {
                folderId = folder;
            } else {
                folderId = folder.id;
            }

            resource.parents = [folderId];
        }

        const fileStream = await context.getFileReadStream(fileId);

        let response;

        if (replace) {
            filename = commons.escapeSpecialCharacters(filename);
            const query = `name='${filename}' and parents in '${folder ? folderId : 'root'}' and trashed=false`;
            const { data } = await drive.files.list({
                q: query
            });
            const { files = [] } = data;
            if (files.length > 0) {
                const file = files[0];
                response = await drive.files.update({
                    fileId: file.id,
                    quotaUser: userId,
                    media: {
                        mimeType: contentType,
                        body: fileStream
                    },
                    fields: '*'
                });
            } else {
                // If no file exists, just create new file
                response = await drive.files.create({
                    quotaUser: userId,
                    resource,
                    media: {
                        mimeType: contentType,
                        body: fileStream
                    },
                    fields: '*'
                });
            }
        } else {
            response = await drive.files.create({
                quotaUser: userId,
                resource,
                media: {
                    mimeType: contentType,
                    body: fileStream
                },
                fields: '*'
            });
        }

        return context.sendJson({
            fileId,
            googleDriveFileMetadata: response.data
        }, 'out');
    }
};

const conversionTypes = {
    'application/msword' : 'application/vnd.google-apps.document',  // doc
    'application/rtf' : 'application/vnd.google-apps.document',  // rtf
    'text/plain' : 'application/vnd.google-apps.document',  // txt
    'application/vnd.oasis.opendocument.text': 'application/vnd.google-apps.document',  // odt
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.google-apps.document', // docx

    'text/csv' : 'application/vnd.google-apps.spreadsheet',  // csv
    'text/tab-separated-values': 'application/vnd.google-apps.spreadsheet',  // tsv
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'application/vnd.google-apps.spreadsheet',  // xlsx
    'application/x-vnd.oasis.opendocument.spreadsheet': 'application/vnd.google-apps.spreadsheet',  // ods

    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'application/vnd.google-apps.presentation',  // pptx
    'application/vnd.oasis.opendocument.presentation': 'application/vnd.google-apps.presentation'  // odp
};
