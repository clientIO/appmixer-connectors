'use strict';

const lib = require('../../lib');

function normalizeTriggeredFor(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    if (typeof value === 'string' && value.length) {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
}

module.exports = {

    async start(context) {

        const webhookUrl = context.getWebhookUrl();
        const { includeSummary, includeTranscript, includeActionItems, includeCrmMatches } = context.properties;

        let triggeredFor = normalizeTriggeredFor(context.properties.triggeredFor);
        if (triggeredFor.length === 0) {
            // Sensible default so the trigger is functional even if nothing was selected.
            // Mirrored by the `defaultValue` on the inspector field.
            triggeredFor = ['my_recordings'];
        }

        // Fathom rejects webhook registration unless at least one content part is requested.
        if (!includeSummary && !includeTranscript && !includeActionItems && !includeCrmMatches) {
            throw new context.CancelError(
                'At least one of Include Summary, Include Transcript, Include Action Items or Include CRM Matches must be turned on.'
            );
        }

        const body = {
            destination_url: webhookUrl,
            triggered_for: triggeredFor
        };
        if (includeSummary) body.include_summary = true;
        if (includeTranscript) body.include_transcript = true;
        if (includeActionItems) body.include_action_items = true;
        if (includeCrmMatches) body.include_crm_matches = true;

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            url: `${lib.API_BASE_URL}/webhooks`,
            headers: {
                ...lib.getHeaders(context),
                'Content-Type': 'application/json'
            },
            data: body
        });

        // There is no list-webhooks endpoint, so the id must be persisted for reliable cleanup.
        return context.saveState({ webhookId: data.id, secret: data.secret });
    },

    async receive(context) {

        if (!context.messages.webhook) {
            return;
        }

        const webhook = context.messages.webhook;
        const payload = (webhook.content && webhook.content.data) || webhook.content || {};

        await context.sendJson(payload, 'out');

        // IMPORTANT: acknowledge the webhook.
        return context.response();
    },

    // Flow Test Mode: emit one realistic payload (the most recent meeting) without registering a
    // webhook. The webhook `new-meeting-content-ready` payload is the meeting object, so the latest
    // meeting from GET /meetings is a faithful stand-in. Read-only, no state writes.
    async test(context) {

        const query = new URLSearchParams({ limit: '1' });
        if (context.properties.includeActionItems) query.append('include_action_items', 'true');
        if (context.properties.includeCrmMatches) query.append('include_crm_matches', 'true');

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            url: `${lib.API_BASE_URL}/meetings?${query.toString()}`,
            headers: lib.getHeaders(context)
        });

        const items = (data && data.items) || [];
        if (items.length === 0) {
            throw new context.CancelError('No recent meetings available to use as test data.');
        }

        return context.sendJson(items[0], 'out');
    },

    async stop(context) {

        const { webhookId } = await context.loadState();

        if (webhookId) {
            await lib.apiRequest(context, {
                method: 'DELETE',
                url: `${lib.API_BASE_URL}/webhooks/${encodeURIComponent(webhookId)}`,
                headers: lib.getHeaders(context)
            });
        }
    }
};
