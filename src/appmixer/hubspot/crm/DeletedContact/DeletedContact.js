const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'contact.deletion';

class DeletedContact extends BaseSubscriptionComponent {

    getSubscriptions() {

        return [{
            enabled: true,
            subscriptionDetails: {
                subscriptionType: this.subscriptionType
            }
        }];
    }

    async receive(context) {

        this.configureHubspot(context);

        if (context.messages.timeout) {

            await context.log({ stage: 'timeout', ...context.messages.timeout });
            return;
        }

        if (context.messages.webhook) {
            const eventsByObjectId = context.messages.webhook.content.data;

            for (const [, event] of Object.entries(eventsByObjectId)) {
                await context.sendJson(event, 'out');
            }
        }
        return context.response();
    }
}

module.exports = new DeletedContact(subscriptionType);
