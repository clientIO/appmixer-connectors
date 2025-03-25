const request = require('../http-commons');
const FormData = require('form-data');

/**
 * This component is used to send HTTP request
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { url, headers, bodyType, fileId } = context.messages.in.content;

        if (bodyType === 'binary') {

            let headersParsed;
            try {
                headersParsed = headers ? JSON.parse(headers) : undefined;
            } catch (error) {
                throw new context.CancelError('Message property "headers" parse error. ' + error.message);
            }
            return await sendBinaryData(context, url, headersParsed, fileId);
        }

        if (bodyType === 'form-data') {

            let headersParsed;
            try {
                headersParsed = typeof headers === 'string' ? JSON.parse(headers) : headers;
            } catch (error) {
                throw new context.CancelError('Message property "headers" parse error. ' + error.message);
            }

            return await sendFormData(context, url, headersParsed);
        }

        return request('POST', context.messages.in.content)
            .then(response => {
                return context.sendJson(response, 'response');
            });
    }
};

const sendBinaryData = async (context, url, headers, binaryFileId) => {
    try {
        const fileStream = await context.getFileReadStream(binaryFileId);
        const fileInfo = await context.getFileInfo(binaryFileId);

        const response = await context.httpRequest({
            method: 'post',
            url,
            data: fileStream,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileInfo.length,
                ...headers
            }
        });

        return await context.sendJson(response.data, 'response');
    } catch (error) {
        throw new Error(`Failed to send binary data: ${error.message}`);
    }
};

const sendFormData = async (context, url, headers) => {

    const { bodyFormData } = context.messages.in.content;
    const variablesArray = bodyFormData?.ADD || [];

    const formData = new FormData();

    for (const variable of variablesArray) {
        const { name, type } = variable;
        const value = variable[type];

        switch (type) {
            case 'filepicker':
                const fileInfo = await context.getFileInfo(value);
                const stream = await context.getFileReadStream(value);
                formData.append(name, stream, {
                    filename: fileInfo.filename,
                    contentType: fileInfo.contentType,
                    knownLength: fileInfo.length
                });
                break;
            case 'text':
            case 'date-time':
            case 'number':
            case 'toggle':
                formData.append(name, value);
                break;
        }
    }

    const response = await context.httpRequest({
        method: 'post',
        url,
        data: formData,
        headers: { ...formData.getHeaders(), ...headers }
    });

    return await context.sendJson(response.data, 'response');
};

