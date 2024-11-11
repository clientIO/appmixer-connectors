'use strict';

const { makeRequest } = require('../commons');

/**
 * Helper to create address object.
 * @param  {String} address
 * @return {{ emailAddress: { address: string }}}
 */
const createAddress = (address) => ({ emailAddress: { address } });

/**
 * Creates a message object structured for the Microsoft Mail endpoint.
 * @param  {Object} json - Input message JSON.
 * @return {Object}
 */
function createMessage(json, attachments = []) {
    const {
        subject,
        contentType = 'Text',
        content,
        toRecipients,
        ccRecipients,
        bccRecipients
    } = json;

    return {
        subject,
        body: {
            contentType,
            content
        },
        toRecipients: toRecipients.split(',').map(createAddress),
        ccRecipients: ccRecipients ? ccRecipients.split(',').map(createAddress) : undefined,
        bccRecipients: bccRecipients ? bccRecipients.split(',').map(createAddress) : undefined,
        attachments
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
            path: '/me/messages',
            method: 'POST',
            data: message
        };

        const result = await makeRequest(context, requestOptions); // Declare result properly
        context.log(result.data);

        // Send a response to indicate the draft was created
        return context.sendJson(result.data, 'email');
    }
};
