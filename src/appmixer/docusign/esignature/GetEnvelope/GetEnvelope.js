'use strict';
const { getEnvelope, normalizeMultiselectInput } = require('../../lib');

/**
 * Get an envelope.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (!context.messages.in.content.envelopeId) {
            throw new context.CancelError(' Envelope ID is required!');
        }

        const { envelopeId, include } = context.messages.in.content;

        // Normalize the multiselect field
        const normalizedInclude = include ?
            normalizeMultiselectInput(include, context, 'Include') : undefined;

        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            envelopeId,
            accountId,
            include: normalizedInclude
        };

        const envelope = await getEnvelope(args, context.auth.accessToken);

        return context.sendJson(envelope, 'out');
    }
};
