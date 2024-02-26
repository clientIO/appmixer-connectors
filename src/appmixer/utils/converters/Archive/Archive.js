'use strict';
const archiver = require('archiver');
const { Parse } = require('unzipper');
const tar = require('tar');
const Stream = require('stream');
const Promise = require('bluebird');

module.exports = {

    async receive(context) {

        const { outputFormat, fileName, archiveFileID, files } = context.messages.in.content;
        const archive = archiver(outputFormat);
        archive.on('error', (err) => {
            throw err;
        });
        const streamPassThrough = new Stream.PassThrough();
        archive.pipe(streamPassThrough);
        const filesList = files?.AND || [];
        const promises = filesList?.map(async (file) => {
            const readStream = await context.getFileReadStream(file.fileId);
            const fileInfo = await context.getFileInfo(file.fileId);
            archive.append(readStream, {
                'name': fileInfo.filename
            });
        });

        await Promise.all(promises, { concurrency: context.config.archiveConcurrency || 10 });
        let savedFile;

        if (archiveFileID) {
            let lock;
            try {
                lock = await context.lock(archiveFileID, context.config.archiveTTL || 180000);
                const readStream = await context.getFileReadStream(archiveFileID);
                if (outputFormat === 'zip') {
                    const zip = readStream.pipe(Parse({ forceStream: true }));
                    for await (const entry of zip) {
                        const passThrough = new Stream.PassThrough();
                        entry.pipe(passThrough);
                        archive.append(passThrough, {
                            'name': entry.path
                        });
                    }
                    archive.finalize();
                } else if (outputFormat === 'tar') {
                    const tarParser = new tar.Parse();
                    const tarStream = readStream.pipe(tarParser);
                    tarStream.on('entry', async (entry) => {
                        const passThrough = new Stream.PassThrough();
                        entry.pipe(passThrough);
                        archive.append(passThrough, {
                            'name': entry.path
                        });
                    });
                    tarStream.on('end', () => {
                        tarParser.end();
                        archive.finalize();
                    });
                }

                savedFile = await context.replaceFileStream(archiveFileID, streamPassThrough);
            } finally {
                lock && lock.unlock();
            }
        } else {
            archive.finalize();
            savedFile = await context.saveFileStream(`${fileName}`, streamPassThrough);
        }

        return context.sendJson({
            fileId: savedFile.metadata.fileId,
            fileName
        }, 'out');
    }
};
