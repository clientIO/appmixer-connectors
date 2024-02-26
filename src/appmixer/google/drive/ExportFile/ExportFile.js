'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        let { isToken, file } = context.messages.in.content;

        if (isToken) {
            return context.sendJson(commons.getCredentials(context.auth), 'out');
        }

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });

        if (typeof file === 'string') {
            const { data } = await drive.files.get({
                fileId: file,
                fields: 'id, name, mimeType'
            });

            file = data;
        }

        let response;
        let { id, name, mimeType } = file;

        if (mimeType.indexOf('vnd.google-apps') !== -1) {
            let format = commons.defaultExportFormats[file.mimeType] || {
                extension: 'pdf',
                mimeType: 'application/pdf'
            };

            const extension = format.extension;
            mimeType = format.mimeType;

            name += `.${extension}`;

            response = await drive.files.export({
                fileId: id,
                mimeType
            }, { responseType: 'stream' });
        } else {
            response = await drive.files.get({
                fileId: id,
                alt: 'media'
            }, { responseType: 'stream' });
        }

        const download = response => {
            return new Promise((resolve, reject) => {
                const data = [];
                response.data
                    .on('end', () => resolve(Buffer.concat(data)))
                    .on('error', err => reject(err))
                    .on('data', d => data.push(d));
            });
        };
        const content = await download(response);

        const { fileId } = await context.saveFileStream(name, content);
        return context.sendJson({
            fileId,
            fileName: name,
            mimeType
        }, 'out');
    }
};
