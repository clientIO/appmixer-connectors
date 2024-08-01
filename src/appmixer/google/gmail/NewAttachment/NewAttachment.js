'use strict';
const commons = require('../../google-commons');
const emailCommons = require('../gmail-commons');
const Promise = require('bluebird');

module.exports = {
    async tick(context) {
        let newState = {};
        let auth = commons.getOauth2Client(context.auth);
        let { userId } = context.auth;

        const { labels: { AND: labels } = { AND: [] } } = context.properties;
        const isLabelsEmpty = !labels.some(label => label.name);

        const data = await commons.listNewMessages({ auth, userId: 'me', quotaUser: userId },
            context.state.id || null);

        // latest message or there are no messages in the inbox
        newState.id = data.lastMessageId;

        const emails = await Promise.map(data.newMessages, async message => {
            return emailCommons.callEndpoint(context, `/users/me/messages/${message.id}`, {
                method: 'GET',
                params: { format: 'full' }
            }).then(response => response.data).catch(err => {
                // email can be deleted (permanently) in gmail between listNewMessages call and
                // this getMessage call, in such case - ignore it and return null
                if (err && err.response && err.response.status === 404) {
                    return null;
                }
                throw err;
            });
        }, { concurrency: 10 });

        let attachments = await Promise.map(emails, email => {
            if (!email || !email.labelIds) {
                // this is the case, when new email was deleted before we could get its details in the previous step
                return [];
            }
            // Filter emails based on selected labels
            if (isLabelsEmpty || labels.some(label => email.labelIds.includes(label.name))) {
                return downloadAttachments(auth, context, email);
            }
            return [];
        });

        attachments = attachments.reduce((a, b) => a.concat(b), []);

        let saved = await Promise.map(attachments, attachment => {
            return context.saveFile(
                attachment.filename,
                attachment.mimetype || 'application/octet-stream', // Fallback to 'application/octet-stream' if mimetype is missing
                Buffer.from(attachment.data, 'base64')
            ).then(res => {
                return Object.assign(res, { subject: attachment.subject });
            });
        });

        await Promise.map(saved, savedFile => {
            return context.sendJson(savedFile, 'attachment');
        });

        await context.saveState(newState);
    }
};

/**
 * This is going to download a new email, parse it and find out whether there are any
 * attachments in that email.
 * @param {OAuth2} auth - google oauth2 client with access token set.
 * @param {Context} context
 * @param {Object} email
 * @return {Array<Object>} returns array with attachments
 */
let downloadAttachments = async (auth, context, email) => {
    if (!commons.isNewInboxEmail(email.labelIds)) {
        return []; // skip SENT and DRAFT emails
    }

    const parsedEmail = await commons.parseEmail(email);

    return Promise.map(parsedEmail.attachments || [], attachment => {
        return emailCommons.callEndpoint(context, `/users/me/messages/${email.id}/attachments/${attachment.id}`, {
            method: 'GET'
        }).then(response => {
            return {
                filename: attachment.filename,
                mimetype: attachment.mimeType || 'application/octet-stream', // Ensure mimetype is set
                size: attachment.size,
                data: response.data.data,
                subject: parsedEmail.subject
            };
        });
    });
};
