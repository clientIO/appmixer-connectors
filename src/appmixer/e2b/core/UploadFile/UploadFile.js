'use strict';

const { buffer: streamToBuffer } = require('stream/consumers');
const { Sandbox } = require('e2b');

module.exports = {

    async receive(context) {

        const { sandboxID, path, fileId } = context.messages.in.content;

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }
        if (!path) {
            throw new context.CancelError('Destination path is required!');
        }
        if (!fileId) {
            throw new context.CancelError('File is required!');
        }

        const fileStream = await context.getFileReadStream(fileId);
        const buffer = await streamToBuffer(fileStream);

        const sandbox = await Sandbox.connect(sandboxID, { apiKey: context.auth.apiKey });

        const entry = await sandbox.files.write(path, buffer);

        return context.sendJson({
            name: entry.name,
            path: entry.path,
            type: entry.type
        }, 'out');
    }
};
