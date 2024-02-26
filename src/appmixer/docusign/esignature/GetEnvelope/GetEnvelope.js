'use strict';
const commons = require('../../docusign-commons');

/**
 * Get an envelope.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { envelopeId, include } = context.messages.in.content;
        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            envelopeId,
            accountId,
            include
        };
        const envelope = await commons.getEnvelope(args, context.auth.accessToken);
        return context.sendJson(envelope, 'out');
    }
};
