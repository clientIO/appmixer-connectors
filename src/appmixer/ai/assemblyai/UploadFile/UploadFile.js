'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;

        if (!fileId) {
            throw new context.CancelError('File is required!');
        }

        const fileStream = await context.getFileReadStream(fileId);

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl(context)}/v2/upload`,
            headers: {
                ...lib.getHeaders(context),
                'Content-Type': 'application/octet-stream'
            },
            data: fileStream,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return context.sendJson({ upload_url: data.upload_url }, 'out');
    }
};
