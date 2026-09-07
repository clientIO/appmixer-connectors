'use strict';
const {
    registerDocusignWebhook,
    unregisterDocusignWebhook,
    normalizeMultiselectInput,
    getEnvelope,
    listLatestEnvelope
} = require('../../lib');

/**
 * Get an envelope.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        let { events } = context.properties;

        // Normalize the multiselect field
        const normalizedEvents = events ?
            normalizeMultiselectInput(events, context, 'Events') : undefined;

        if (!normalizedEvents || normalizedEvents.length === 0) {
            events = [
                'envelope-sent',
                'envelope-resent',
                'envelope-delivered',
                'envelope-completed',
                'envelope-declined',
                'envelope-voided',
                'envelope-corrected',
                'envelope-purge',
                'envelope-deleted'
            ];
        } else {
            events = normalizedEvents;
        }

        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            accountId,
            events
        };

        // eslint-disable-next-line max-len
        const { connectId } = await registerDocusignWebhook(args, context.auth.accessToken, context.getWebhookUrl());
        await context.saveState({ connectId });
    },

    async stop(context) {

        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        let args = {
            basePath,
            accountId
        };
        return unregisterDocusignWebhook(args, context.auth.accessToken, context.state.connectId);
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
            return context.response({});
        }
    },

    // Flow Test Mode: fetch the most recent envelope (read-only) and reshape it into
    // the DocuSign Connect restv2.1 aggregate body this trigger's webhook delivers, so
    // the emitted shape matches what receive() forwards. data.envelopeSummary is the
    // real fetched envelope (the part downstream components consume).
    async test(context) {

        const { base_uri: basePath, account_id: accountId } = context.profileInfo.accounts[0];
        const accessToken = context.auth.accessToken;

        const latest = await listLatestEnvelope({ basePath, accountId }, accessToken);
        if (!latest) {
            throw new Error('No recent envelopes to use as test data.');
        }

        const envelope = await getEnvelope(
            { basePath, accountId, envelopeId: latest.envelopeId, include: ['recipients'] },
            accessToken
        );

        // Derive the Connect event from the envelope status, honoring the configured
        // events filter: if the watched list doesn't include this status, fall back to
        // the first configured event so the sample respects the trigger's filter.
        const normalizedEvents = context.properties.events
            ? normalizeMultiselectInput(context.properties.events, context, 'Events')
            : [];
        const statusEvent = `envelope-${envelope.status}`;
        const event = (normalizedEvents.length && !normalizedEvents.includes(statusEvent))
            ? normalizedEvents[0]
            : statusEvent;

        const payload = {
            event,
            apiVersion: 'v2.1',
            uri: `/restapi/v2.1/accounts/${accountId}/envelopes/${envelope.envelopeId}`,
            retryCount: 0,
            configurationId: context.state.connectId || null,
            generatedDateTime: new Date().toISOString(),
            data: {
                accountId,
                userId: context.profileInfo.sub,
                envelopeId: envelope.envelopeId,
                envelopeSummary: envelope
            }
        };
        return context.sendJson(payload, 'out');
    }
};
