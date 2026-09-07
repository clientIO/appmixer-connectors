'use strict';

const pathModule = require('path');
const { Sandbox } = require('e2b');

module.exports = {

    async receive(context) {

        const { sandboxID, path } = context.messages.in.content;

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }
        if (!path) {
            throw new context.CancelError('File path is required!');
        }

        const sandbox = await Sandbox.connect(sandboxID, { apiKey: context.auth.apiKey });

        const bytes = await sandbox.files.read(path, { format: 'bytes' });
        const buffer = Buffer.from(bytes);

        const fileName = pathModule.basename(path);
        const savedFile = await context.saveFileStream(fileName, buffer);

        return context.sendJson({ fileId: savedFile.fileId, fileName }, 'out');
    }
};
