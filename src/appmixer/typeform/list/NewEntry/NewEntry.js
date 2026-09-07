'use strict';
const typeFormApi = require('@typeform/api-client');

// Maps a Typeform `form_response` (same shape in the webhook body and in the
// Responses API items) to the trigger's output. Shared by receive() and test()
// so both emit an identical object.
async function buildEntry(context, formResponse) {

    const out = {
        submittedAt: formResponse['submitted_at'],
        landedAt: formResponse['landed_at'],
        answers: {}
    };

    for (const answer of formResponse.answers || []) {
        switch (answer.type) {
            case 'choice':
                out.answers[answer.field.id] = answer.choice.label;
                break;
            default:
                if (answer[answer.type]) {
                    out.answers[answer.field.id] = answer[answer.type];
                } else {
                    await context.log({
                        error: `Unknown answer type: ${answer.type}.`,
                        answer
                    });
                }
                break;
        }
    }
    return out;
}

/**
 * Component which triggers whenever new typeform is filled.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            let data = context.messages.webhook.content.data;
            if (data['event_type'] === 'form_response') {
                const out = await buildEntry(context, data['form_response']);
                await context.sendJson(out, 'entry');
                return context.response();
            }
        }
    },

    // Flow Test Mode: fetch the most recent submitted response for the form and
    // emit it in the same shape receive() produces from the webhook body.
    async test(context) {

        const { UID } = context.properties;
        if (!UID) {
            throw new context.CancelError('Form (UID) is required!');
        }

        const client = typeFormApi.createClient({ token: context.auth.accessToken });
        // Responses API returns newest first; one item is enough for a sample.
        const { items } = await client.responses.list({ uid: UID, pageSize: 1 });
        const latest = (items || [])[0];
        if (!latest) {
            throw new Error('No recent form responses to use as test data.');
        }

        const out = await buildEntry(context, latest);
        return context.sendJson(out, 'entry');
    },

    async start(context) {

        await typeFormApi.createClient({ token: context.auth.accessToken })
            .webhooks
            .create({
                uid: context.properties.UID,
                tag: context.componentId,
                url: context.getWebhookUrl(),
                enabled: true
            });
        await context.saveState({ webhookTag: context.componentId });
    },

    async stop(context) {

        if (context.state.webhookTag) {
            await typeFormApi.createClient({ token: context.auth.accessToken })
                .webhooks
                .delete({
                    uid: context.properties.UID,
                    tag: context.componentId
                });
        }
    }
};
