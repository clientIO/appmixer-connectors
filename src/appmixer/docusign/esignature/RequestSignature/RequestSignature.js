'use strict';
const commons = require('../../docusign-commons');

/**
 * Get an envelope.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'completed');
            return context.response({});
        }
        const envelopeArgs = context.messages.in.content;
        let docs = envelopeArgs.documents.AND;
        for (let i = 0; i < docs.length; i++) {
            docs[i].doc = await context.loadFile(docs[i].document);
            let fileInfo = await context.getFileInfo(docs[i].document);
            docs[i].fileName = fileInfo && fileInfo.filename.split('.')[0];
        }
        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            accountId,
            envelopeArgs,
            docs
        };
        const envelope = await commons.requestSignature(args, context.auth.accessToken, context.getWebhookUrl());
        return context.sendJson(envelope, 'out');
    }
};
