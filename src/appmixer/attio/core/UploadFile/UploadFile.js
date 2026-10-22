'use strict';

const FormData = require('form-data');
const lib = require('../../lib');

// Attio's upload limit.
const MAX_FILE_SIZE = 50 * 1024 * 1024;

module.exports = {

    async receive(context) {

        const { objectId, recordId, fileId, fileName, parentFolderId } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Object is required!');
        }
        if (!recordId) {
            throw new context.CancelError('Record ID is required!');
        }
        if (!fileId) {
            throw new context.CancelError('File is required!');
        }

        let fileInfo;
        try {
            fileInfo = await context.getFileInfo(fileId);
        } catch (err) {
            throw new context.CancelError(`File ${fileId} was not found in Appmixer file storage.`);
        }
        if (!fileInfo) {
            throw new context.CancelError(`File ${fileId} was not found in Appmixer file storage.`);
        }
        if (fileInfo.length > MAX_FILE_SIZE) {
            throw new context.CancelError('The file is larger than 50 MB, the maximum Attio accepts.');
        }

        const form = new FormData();
        form.append('object', objectId);
        form.append('record_id', recordId);
        if (parentFolderId) form.append('parent_folder_id', parentFolderId);
        form.append('file', await context.getFileReadStream(fileId), {
            filename: fileName || fileInfo.filename,
            contentType: fileInfo.contentType || 'application/octet-stream',
            knownLength: fileInfo.length
        });

        // https://docs.attio.com/rest-api/endpoint-reference/files/upload-a-file
        const data = await lib.apiRequest(context, {
            method: 'POST',
            path: '/v2/files/upload',
            headers: form.getHeaders(),
            data: form
        });

        return context.sendJson(lib.mapFile(data.data), 'out');
    }
};
