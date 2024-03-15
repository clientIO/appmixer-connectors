'use strict';
const mandrill = require('mandrill-api/mandrill');
const Promise = require('bluebird');

module.exports = {

    async receive(context) {

        const API_KEY = context.auth.apiKey || 'bzjR9BOFhPkojdmK_SCh1A';

        let client = new mandrill.Mandrill(API_KEY);
        let message = context.messages.in.content;
        let recipients = Array.isArray(message.to) ? message.to : [message.to];

        message.to = recipients.map(recipient => {
            return {
                'email': recipient,
                'type': 'to'
            };
        });

        message['from_email'] = context.auth.fromEmail || 'no-reply@appmixer.com';
        if (message['reply-to']) {
            message.headers = { 'Reply-To': message['reply-to'] };
            delete message['reply-to'];
        }

        const { attachments = {} } = context.messages.in.content;
        const fileIds = (attachments.ADD || [])
            .map(attachment => (attachment.fileId || null))
            .filter(fileId => fileId !== null);

        message.attachments = await Promise.map(fileIds, async (fileId) => {
            const fileContent = (await context.loadFile(fileId)).toString('base64');
            const fileInfo = await context.getFileInfo(fileId);
            return {
                type: fileInfo.contentType,
                name: fileInfo.filename,
                content: fileContent
            };
        });

        return new Promise((resolve, reject) => {
            client.messages.send(
                { message },
                (result) => {
                    if (!result) {
                        return reject('Invalid response from mandrill.');
                    }
                    if (['sent', 'queued', 'scheduled'].indexOf(result[0].status) > -1) {
                        return resolve(result);
                    }
                    reject(new Error('Email status: ' + result[0].status +
                        (result[0].status === 'rejected' ? ', reason: ' + result[0]['reject_reason'] : '')
                    ));
                },
                err => {
                    reject(err);
                }
            );
        }).then(result => {
            return context.sendJson({}, 'out');
        });
    }
};
