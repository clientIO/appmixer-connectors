'use strict';
const commons = require('../../google-commons');
const GoogleApi = commons.GoogleApi;
const Promise = require('bluebird');
const gmail = GoogleApi.gmail('v1');

const getMessage = Promise.promisify(gmail.users.messages.get, { context: gmail.users.messages });
const getAttachment = Promise.promisify(gmail.users.messages.attachments.get, { context: gmail.users.messages });

/**
 * This is going to download new email, parse it and found out whether there any
 * attachments in that email.
 * @param {OAuth2} auth - google oauth2 client with access token set.
 * @param {Context} context
 * @param {Object} email
 * @return {Array<Object>} returns array with attachments
 */
let downloadAttachments = async (auth, context, email) => {

    if (!commons.isNewInboxEmail(email.labelIds)) {
        return [];    // skip SENT and DRAFT emails
    }

    const parsedEmail = await commons.parseEmail(email);

    return Promise.map(parsedEmail.attachments || [], attachment => {
        return getAttachment({
            auth,
            id: attachment.id,
            messageId: email.id,
            userId: 'me'
        }).then(attachmentData => {
            return {
                filename: attachment.filename,
                mimetype: attachment.mimetype,
                size: attachment.size,
                data: attachmentData.data,
                subject: parsedEmail.subject
            };
        });
    });
};

/**
 * Component will trigger anytime there is a new email with attachment(s) in your mailbox
 * and send those attachments to output port.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let auth = commons.getOauth2Client(context.auth);
        let newState = {};

        const { labels: { AND: labels } = { AND: [] } } = context.properties;

        const isLabelsEmpty = !labels.some(label => label.name);

        let result = await commons.listNewMessages(
            { auth: auth, userId: 'me', quotaUser: context.auth.userId },
            context.state.id || null);

        // latest message or there are no messages in the inbox
        newState.id = result.lastMessageId;

        let emails = await Promise.map(result.newMessages, async diff => {
            return getMessage({
                auth,
                userId: 'me',
                quotaUser: context.auth.userId,
                format: 'full',
                id: diff.id
            }).catch(err => {
                // email can be deleted (permanently) in gmail between listNewMessages call and
                // this getMessage call, in such case - ignore it and return null
                if (err && err.code === 404) {
                    return null;
                }
                throw err;
            });
        });

        let attachments = await Promise.map(emails, email => {
            if (!email) {
                // this is the case, when new email was deleted before we could get it's details in previous step
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
                attachment.mimetype,
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
