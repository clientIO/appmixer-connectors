const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');

const subscriptionType = 'contact.deletion';

class DeletedContact extends BaseSubscriptionComponent {

    async receive(context) {

        this.configureHubspot(context);

        if (context.messages.timeout) {

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

    // No fetchable example: a deletion emits the raw webhook event for a contact
    // that no longer exists, and HubSpot exposes no API to list past deletion
    // events. Throw so Flow Test Mode falls through to the log/schema fallbacks.
    async test(context) {

        throw new context.CancelError(
            'DeletedContact can only be tested by deleting a contact in HubSpot — there is no API to fetch a past deletion event.'
        );
    }
}

module.exports = new DeletedContact(subscriptionType);
