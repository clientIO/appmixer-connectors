'use strict';
const { URL } = require('url');

const isValidUrl = (s) => {
    try {
        new URL(s);
        return true;
    } catch (err) {
        return false;
    }
};

module.exports = {

    async receive(context) {

        const { link, customFileName } = context.messages.in.content;
        if (!isValidUrl(link)) throw new context.CancelError('Invalid link');

        const response = await context.httpRequest.get(link, { responseType: 'stream' });
        const readStream = response.data;
        const filename = customFileName || (
            response.headers['content-disposition'] &&
            response.headers['content-disposition'].split('filename=')[1]
        ) || link.split('/').pop();

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const file = await context.saveFileStream(filename.replace(/"/g, ''), readStream);

        return context.sendJson({
            fileId: file.fileId,
            filename: filename,
            contentType
        }, 'out');
    }
};
