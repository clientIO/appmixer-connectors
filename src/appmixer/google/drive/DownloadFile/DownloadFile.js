'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        const {
            fileId,
            customFileName,
            outputFileData,
            outputFileDataEncoding,
            conversionTargetDocuments,
            conversionTargetSpreadsheets,
            conversionTargetPresentations,
            conversionTargetDrawings,
            conversionTargetAppsScript
        } = context.messages.in.content;

        const { data: metadata } = await drive.files.get({
            fileId: typeof fileId === 'string' ? fileId : fileId.id,
            fields: '*'
        });

        // https://developers.google.com/drive/api/guides/ref-export-formats
        let conversionTarget = 'none';
        if (conversionTargetDocuments !== 'none' && metadata.mimeType === 'application/vnd.google-apps.document') {
            conversionTarget = conversionTargetDocuments;
        } else if (conversionTargetSpreadsheets !== 'none' && metadata.mimeType === 'application/vnd.google-apps.spreadsheet') {
            conversionTarget = conversionTargetSpreadsheets;
        } else if (conversionTargetPresentations !== 'none' && metadata.mimeType === 'application/vnd.google-apps.presentation') {
            conversionTarget = conversionTargetPresentations;
        } else if (conversionTargetDrawings !== 'none' && metadata.mimeType === 'application/vnd.google-apps.drawing') {
            conversionTarget = conversionTargetDrawings;
        } else if (conversionTargetAppsScript !== 'none' && metadata.mimeType === 'application/vnd.google-apps.script') {
            conversionTarget = conversionTargetAppsScript;
        }

        let filename = customFileName || metadata.name;

        let stream;
        if (conversionTarget !== 'none') {
            stream = (await drive.files.export({
                fileId: metadata.id,
                mimeType: conversionTarget
            }, { responseType: 'stream' })).data;;
            filename = customFileName ? customFileName : metadata.name + '.' + mimeTypeToExtension[conversionTarget];
        } else {
            stream = (await drive.files.get({
                fileId: metadata.id,
                alt: 'media'
            }, { responseType: 'stream' })).data;
        }

        const appmixerFile = await context.saveFileStream(filename, stream);

        const out = {
            fileId: appmixerFile.fileId,
            filename: appmixerFile.filename,
            length: appmixerFile.length,
            googleDriveFileMetadata: metadata
        };

        if (outputFileData) {
            out.content = (await context.loadFile(appmixerFile.fileId)).toString(outputFileDataEncoding || 'utf8');
        }

        return context.sendJson(out, 'out');
    }
};

const mimeTypeToExtension = {
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/rtf': 'rtf',
    'application/zip': 'zip',
    'application/vnd.oasis.opendocument.text': 'odt',
    'application/epub+zip': 'epub',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/csv': 'csv',
    'text/tab-separated-values': 'tsv',
    'application/x-vnd.oasis.opendocument.spreadsheet': 'ods',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.oasis.opendocument.presentation': 'odp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'application/vnd.google-apps.script+json': 'json'
};
