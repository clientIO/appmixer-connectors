'use strict';

const { URL } = require('url');

function isValidUrl(value) {
    try {
        new URL(value);
        return true;
    } catch (error) {
        return false;
    }
}

module.exports = {

    async receive(context) {

        const { url, fileName } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('Media URL is required!');
        }
        if (!isValidUrl(url)) {
            throw new context.CancelError('Media URL is invalid!');
        }

        const response = await context.httpRequest({
            method: 'GET',
            url,
            responseType: 'stream'
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const name = (fileName || url.split('/').pop().split('?')[0] || 'fal-download').replace(/"/g, '');

        const file = await context.saveFileStream(name, response.data);

        const size = response.headers['content-length']
            ? Number(response.headers['content-length'])
            : undefined;

        return context.sendJson({
            fileId: file.fileId,
            fileName: name,
            contentType,
            size
        }, 'out');
    }
};
