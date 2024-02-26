'use strict';

const { makeRequest } = require('../commons');

/**
 * Helper to create address object.
 * @param  {String} address
 * @return {{ emailAddress: { address: string }}}
 */
const createAddress = (address) => ({ emailAddress: { address } });

/**
 * Creates message JSON structured for Microsoft Mail endpoint.
 * @param  {Object} json - Input message JSON.
 * @param  {Array} attachments - Array of attachments with format accepted by the API.
 * @return {Object}
 */
function createMessage(json, attachments = []) {
    const {
        subject,
        contentType = 'Text',
        content,
        toRecipients,
        ccRecipients,
        saveToSentItems = true
    } = json;

    return {
        message: {
            subject,
            body: {
                contentType,
                content
            },
            toRecipients: toRecipients.split(',').map(createAddress),
            ccRecipients: ccRecipients ? ccRecipients.split(',').map(createAddress) : undefined,
            attachments
        },
        saveToSentItems
    };
}

async function getMailAttachments(context, attachments) {
    const fileIds = (attachments.ADD || []).map((attachment) => attachment.fileId).filter(Boolean);

    const attachmentPromises = fileIds.map(async (fileId) => {
        const fileInfo = await context.getFileInfo(fileId);
        const fileContent = await context.loadFile(fileId);
        return {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: fileInfo.filename,
            contentType: fileInfo.contentType,
            contentBytes: fileContent.toString('base64')
        };
    });

    return Promise.all(attachmentPromises);
}

module.exports = {

    async receive(context) {

        const { attachments = {} } = context.messages.in.content;
        const mailAttachments = await getMailAttachments(context, attachments);

        const message = createMessage(context.messages.in.content, mailAttachments);
        const requestOptions = {
            path: '/me/sendMail',
            method: 'POST',
            data: message
        };

        await makeRequest(context, requestOptions);

        // No data sent as a response from the Microsoft endpoint, so send something
        return context.sendJson({ result: 'ok' }, 'email');
    }
};
