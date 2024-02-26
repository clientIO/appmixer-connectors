'use strict';
const typeFormApi = require('@typeform/api-client');

/**
 * Component which triggers whenever new typeform is filled.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            let data = context.messages.webhook.content.data;
            if (data['event_type'] === 'form_response') {
                let out = {
                    submittedAt: data['form_response']['submitted_at'],
                    landedAt: data['form_response']['landed_at'],
                    answers: {}
                };

                for (const answer of data['form_response'].answers) {
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
                await context.sendJson(out, 'entry');
                return context.response();
            }
        }
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
