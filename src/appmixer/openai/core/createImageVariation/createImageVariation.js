'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + '/images/variations';

        const headers = {};

        const inputMapping = {
            'image': input['image'],
            'model': input['model'],
            'n': input['n'],
            'response_format': input['response_format'],
            'size': input['size'],
            'user': input['user']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        // Request media type is multipart/form-data. Convert body to FormData object.

        const fileUploadProperties = {
            'image': true,
            'model': false,
            'n': false,
            'response_format': false,
            'size': false,
            'user': false
        };

        const form = new lib.FormData;
        for (const propertyName of Object.keys(requestBody || {})) {
            const propertyValue = requestBody[propertyName];

            if (fileUploadProperties[propertyName]) {
                const fileInfo = await context.getFileInfo(propertyValue);
                const fileStream = await context.getFileReadStream(propertyValue);
                // Note that since we're uploading using the GridFSBucketReadStream, we need to provide additional
                // info such as the `filename` to the FormData library. Otherwise, we would get back "MultipartFile content must be provided" error.
                form.append(propertyName, fileStream, { type: 'application/octet-stream', filename: fileInfo.filename });
            } else {
                form.append(propertyName, propertyValue);
            }
        }
        headers['Content-Type'] = `multipart/form-data; boundary=${form.getBoundary()}`;
        requestBody = form;

        headers['Authorization'] = 'Bearer {apiKey}'.replace(/{(.*?)}/g, (match, variable) => context.auth[variable]);

        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };

        try {
            const response = await context.httpRequest(req);
            const log = {
                step: 'http-request-success',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers
                },
                response: {
                    data: response.data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                }
            };
            await context.log(log);
            return response;
        } catch (err) {
            const log = {
                step: 'http-request-error',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers
                },
                response: err.response ? {
                    data: err.response.data,
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                } : undefined
            };
            await context.log(log);
            throw err;
        }
    }

};
