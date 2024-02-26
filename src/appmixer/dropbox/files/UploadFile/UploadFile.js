'use strict';
const DropboxStream = require('dropbox-stream');
const Promise = require('bluebird');

module.exports = {

    async receive(context) {

        const { fileId, filename, path } = context.messages.file.content;

        const fileStream = await context.getFileReadStream(fileId);
        const uploadFn = () => {
            return new Promise((resolve, reject) => {
                const pipe = DropboxStream.createDropboxUploadStream({
                    token: context.auth.accessToken,
                    path: (path ? path : '') + '/' + filename,
                    chunkSize: 1000 * 1024,
                    autorename: true,
                    mode: 'add'
                })
                    .on('error', (err) => {
                        reject(err);
                    })
                    .on('metadata', (metadata) => {
                        resolve(metadata);
                    });

                fileStream.pipe(pipe);
            });
        };

        const result = await uploadFn();
        return context.sendJson(
            {
                fileId,
                filename: result.name,
                path: result['path_display']
            },
            'uploaded'
        );
    }
};
