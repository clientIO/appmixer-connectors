'use strict';
const BaseSubscriptionComponent = require('../../BaseSubscriptionComponent');
const { getObjectProperties } = require('../../commons');
const ITEM_SCHEMA = require('../../item-schemas.json').contact;

const subscriptionType = 'contact.creation';

class NewContact extends BaseSubscriptionComponent {

    async receive(context) {

        const eventsByObjectId = context.messages.webhook.content.data;

        this.configureHubspot(context);

        // Get all objectIds that will be used to fetch the contacts in bulk
        let ids = [];
        // Locking to avoid duplicates. HubSpot payloads can come within milliseconds of each other.
        let lock;

        try {
            lock = await context.lock(context.componentId, {
                ttl: 1000 * 10,
                retryDelay: 500,
                maxRetryCount: 3
            });

            for (const [contactId] of Object.entries(eventsByObjectId)) {
                // Scope the dedupe key per component instance — staticCache is shared across all
                // instances, so two flows must not consume each other's events.
                const cacheKey = `hubspot-contact-created-${context.componentId}-${contactId}`;
                const cached = await context.staticCache.get(cacheKey);
                if (cached) {
                    continue;
                }
                // Cache the event for 5s to avoid duplicates
                await context.staticCache.set(cacheKey, contactId, context.config?.eventCacheTTL || 5000);
                ids.push(contactId);
            }
        } finally {
            await lock?.unlock();
        }

        if (!ids.length) {
            // No new contacts to fetch
            return context.response();
        }

        let propertiesToReturn;
        const { properties } = context.properties;
        if (!properties) {
            // Return all properties by default.
            propertiesToReturn = await getObjectProperties(context, this.hubspot, 'contacts', 'names');
        } else {
            propertiesToReturn = properties.split(',');
        }

        // Call the API to get the contacts in bulk
        const { data } = await this.hubspot.call('post', 'crm/v3/objects/contacts/batch/read', {
            inputs: ids.map((id) => ({ id })),
            properties: propertiesToReturn
        });

        await context.sendArray(data.results, 'contact');

        return context.response();
    }

    async test(context) {

        const record = await this.fetchLatestExample(context, 'contacts');
        if (!record) {
            throw new context.CancelError('No contact found to use as test data.');
        }
        return context.sendJson(record, 'contact');
    }
}

module.exports = new NewContact(subscriptionType);
module.exports.ITEM_SCHEMA = ITEM_SCHEMA;
