'use strict';
const Dropbox = require('dropbox').Dropbox;
const DropboxStream = require('dropbox-stream');

module.exports = {

    async receive(context) {

        let dbx = new Dropbox({
            accessToken: context.auth.accessToken
        });
        const { result: file } = await dbx.filesGetMetadata({
            path: context.messages.file.content.fileId
        });

        if (!file.path_lower) {
            throw new Error('The requested file or folder is not mounted.');
        }

        const fileStream = DropboxStream.createDropboxDownloadStream({
            token: context.auth.accessToken,
            path: file.path_lower
        }).on('error', (err) => {
            throw err;
        });

        const downloadedFile = await context.saveFileStream(file.name, fileStream);
        return context.sendJson(downloadedFile, 'downloaded');
    }
};
