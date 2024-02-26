'use strict';

const parseDataUrl = require('parse-data-url');
const extname = require('path').extname;
const mime = require('mime-types');

module.exports = {

    async receive(context) {

        const { dataUri } = context.messages.in.content;
        let { fileName = 'result' } = context.messages.in.content;

        const parsed = parseDataUrl(dataUri);
        if (!parsed) {
            throw new context.CancelError('Invalid Data URI.');
        }

        const contentType = parsed.contentType || 'application/octet-stream';

        if (!extname(fileName)) {
            fileName += '.' + (mime.extension(contentType) || 'bin');
        }

        const savedFile = await context.saveFile(fileName, contentType, parsed.toBuffer());
        return context.sendJson({ fileId: savedFile.fileId, fileName }, 'out');
    }
};
