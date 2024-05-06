'use strict';

const mailchimp = require('@mailchimp/mailchimp_transactional');

module.exports = {

    async receive(context) {

        const API_KEY = context.auth.apiKey;

        const client = mailchimp(API_KEY);
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

        message.attachments = await Promise.all(fileIds.map(async (fileId) => {
            const fileContent = (await context.loadFile(fileId)).toString('base64');
            const fileInfo = await context.getFileInfo(fileId);
            return {
                type: fileInfo.contentType,
                name: fileInfo.filename,
                content: fileContent
            };
        }));

        // Appmixer cloud solution is used when the API key is not provided or it is the default one created during provisioning.
        const useCloudApi = isAppmixerDefaultApiKey(API_KEY) || !API_KEY;
        if (useCloudApi) {
            const url = process.env.APPMIXER_CLOUD_API_URL ? process.env.APPMIXER_CLOUD_API_URL + '/email/send' : 'https://cloud.appmixer.com/api/email/send';
            const headers = {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            };
            await context.httpRequest({
                url,
                method: 'POST',
                headers,
                data: { message }
            });
            return context.sendJson({}, 'out');
        }

        // Using tenant's own Mailchimp API key.
        try {
            const result = await client.messages.send({ message });
            if (!result) {
                throw 'Invalid response from Mailchimp.';
            }
            if (['sent', 'queued', 'scheduled'].indexOf(result[0].status) > -1) {
                return context.sendJson({}, 'out');
            }
            throw (new Error('Email status: ' + result[0].status +
                (result[0].status === 'rejected' ? ', reason: ' + result[0]['reject_reason'] : '')
            ));
        } catch (err) {
            throw err;
        }
    }
};

function isAppmixerDefaultApiKey(apiKey) {
    return apiKey?.startsWith('amp_') && apiKey.length === 40;
}
