'use strict';

const Hubspot = require('./Hubspot');
const { getObjectProperties } = require('./commons');

class BaseSubscriptionComponent {

    constructor(subscriptionType, options = {}) {

        this.subscriptionType = subscriptionType;
        this.hubspot = new Hubspot('', options);
    }

    configureHubspot(context) {

        const { config, auth } = context;
        this.hubspot.setApiKey(config.apiKey);
        this.hubspot.setAppId(config.appId);
        this.hubspot.setToken(auth.accessToken);
    }

    async ensureWebhook(context) {

        // Skip the check if using AuthHub
        if (context.config.usesAuthHub) {
            return;
        }

        // Check if we have appId and apiKey
        const { appId, apiKey } = context.config;
        if (!appId || !apiKey) {
            throw new context.CancelError('HubSpot appId or apiKey missing in configuration.');
        }

        let webhookConfiguredProperly = false;
        let existingTargetURL = null;
        const targetURL = context.appmixerApiUrl + '/plugins/appmixer/hubspot/events';

        // Use cache to avoid hitting HubSpot API too often
        const cacheKey = 'hubspot_webhook_' + appId;
        let lock;
        try {
            // Only one trigger at a time
            lock = await context.lock(cacheKey);

            const targetURLCached = await context.staticCache.get(cacheKey);
            if (targetURLCached) {
                existingTargetURL = targetURLCached;
            } else {
                // Check webhooks/v3/${appId}/settings
                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: `https://api.hubapi.com/webhooks/v3/${appId}/settings?hapikey=${apiKey}`
                });

                await context.staticCache.set(
                    cacheKey,
                    data?.targetUrl || null,
                    // 1 hour cache by default
                    context.config.webhookTargetURLCacheTTL || (60 * 60 * 1000)
                );

                existingTargetURL = data?.targetUrl;
            }

            if (existingTargetURL) {
                webhookConfiguredProperly = existingTargetURL === targetURL;
            } else {
                webhookConfiguredProperly = false;
            }
        } catch (error) {
            // Axios errors expose the HTTP response in error.response
            const status = error?.response?.status ?? error?.status;
            context.log({ step: 'hubspot-plugin-error', status, code: error.code, error });
            if (status === 404) {
                // Webhook not found, need to register
                context.log({ step: 'hubspot-plugin-webhook-not-found-registering', message: `Registering webhook with target URL ${targetURL}` });
                await this.hubspot.registerWebhook(targetURL);
            } else {
                // Unexpected error - propagate and fail the startup
                context.log({ step: 'hubspot-plugin-error-while-fetching-webhook-settings', status, code: error.code, error, message: `Failed to set up webhook with target URL ${targetURL}` });
                throw new context.CancelError(`Error while fetching webhook settings: ${error.message}`);
            }
        } finally {
            lock?.unlock();
        }
        if (!webhookConfiguredProperly) {
            throw new context.CancelError(`HubSpot webhook not configured properly, wrong target URL. Expected: ${targetURL}, existing: ${existingTargetURL}`);
        }
    }

    async receive(context) {

        throw new Error('Must be extended');
    }

    async start(context) {

        this.configureHubspot(context);

        await this.ensureWebhook(context);

        // Use hub_id from context to differentiate between different HubSpot portals/users.
        const portalId = context.auth?.profileInfo?.hub_id;
        return context.addListener(`${this.subscriptionType}:${portalId}`, { apiKey: context.config.apiKey, appId: context.config.appId });
    }

    async stop(context) {

        this.configureHubspot(context);
        const portalId = context.auth?.profileInfo?.hub_id;
        return context.removeListener(`${this.subscriptionType}:${portalId}`);
    }

    /**
     * Flow Test Mode helper shared by every subscription trigger's test(). Fetches the
     * newest object of `objectType` via the CRM search API and emits it on `outputPort`
     * in the SAME shape receive() emits (an element of a batch/read result:
     * { id, properties, createdAt, updatedAt, archived }). Honors the same `properties`
     * selection as receive(); callers pass any property filters (pipeline, dealstage)
     * so the example matches the trigger's configuration.
     * @param {string} objectType 'contacts' | 'deals'
     * @param {object} [opts]
     * @param {string} [opts.sortProperty] property to sort newest-first ('createdate' by default)
     * @param {object[]} [opts.filters] HubSpot search filters ({ propertyName, operator, value })
     * @returns {Promise<object>} The newest record.
     */
    async fetchLatestExample(context, objectType, { sortProperty = 'createdate', filters = [] } = {}) {

        this.configureHubspot(context);

        let propertiesToReturn;
        const { properties } = context.properties;
        if (!properties) {
            propertiesToReturn = await getObjectProperties(context, this.hubspot, objectType, 'names');
        } else {
            propertiesToReturn = properties.split(',');
        }

        const body = {
            sorts: [{ propertyName: sortProperty, direction: 'DESCENDING' }],
            properties: propertiesToReturn,
            limit: 1
        };
        if (filters.length) {
            body.filterGroups = [{ filters }];
        }

        const { data } = await this.hubspot.call('post', `crm/v3/objects/${objectType}/search`, body);
        const record = data.results && data.results[0];
        if (!record) {
            throw new context.CancelError(`No ${objectType} found to use as test data.`);
        }

        return record;
    }
}

module.exports = BaseSubscriptionComponent;
