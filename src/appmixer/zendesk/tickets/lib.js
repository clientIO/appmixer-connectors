'use strict';

const mime = require('mime-types');

module.exports = {

    uploadFile: async function(context, fileId) {

        const fileStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/uploads.json?filename=${fileInfo.filename}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken,
            'Content-Type': mime.lookup(fileInfo.filename) || 'application/octet-stream'
        };
        const req = {
            url: url,
            method: 'POST',
            data: fileStream,
            headers: headers
        };
        return context.httpRequest(req);
    }
};
