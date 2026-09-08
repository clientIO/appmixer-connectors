'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { fileId, contentType } = context.messages.in.content;

        if (!fileId) {
            throw new context.CancelError('File is required!');
        }

        const fileInfo = await context.getFileInfo(fileId);
        const type = contentType || fileInfo.contentType || 'application/octet-stream';
        const fileName = fileInfo.filename;

        // Step 1: register the upload and obtain a presigned upload URL + final public URL.
        const initiate = await lib.request(context, {
            method: 'POST',
            url: `${lib.REST_URL}/storage/upload/initiate?storage_type=fal-cdn-v3`,
            headers: {
                ...lib.authHeaders(context),
                'Content-Type': 'application/json'
            },
            data: {
                content_type: type,
                file_name: fileName
            }
        });

        const uploadUrl = initiate.data && initiate.data.upload_url;
        const fileUrl = initiate.data && initiate.data.file_url;
        if (!uploadUrl || !fileUrl) {
            throw new context.CancelError('fal did not return an upload URL.');
        }

        // Step 2: stream the file bytes to the presigned URL.
        const readStream = await context.getFileReadStream(fileId);
        const uploadHeaders = { 'Content-Type': type };
        if (fileInfo.length !== undefined && fileInfo.length !== null) {
            uploadHeaders['Content-Length'] = fileInfo.length;
        }

        await context.httpRequest({
            method: 'PUT',
            url: uploadUrl,
            headers: uploadHeaders,
            data: readStream,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        return context.sendJson({
            url: fileUrl,
            contentType: type,
            fileName,
            size: fileInfo.length
        }, 'out');
    }
};
