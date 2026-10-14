'use strict';

const crypto = require('crypto');
const { makeRequest, statusOf } = require('./commons');

// Graph allows 4320 minutes (3 days) for chat and channel message subscriptions when a
// lifecycle notification URL is set, and only 60 minutes without one.
// https://learn.microsoft.com/en-us/graph/api/resources/subscription
const LIFETIME_MS = 4320 * 60 * 1000;

// Renew early so a slow or throttled request cannot miss the expiry.
const RENEW_BEFORE_MS = 5 * 60 * 1000;

// The engine rounds anything below a minute up to a minute; be explicit about the floor.
const MIN_TIMEOUT_MS = 60 * 1000;

const expiresAt = () => new Date(Date.now() + LIFETIME_MS);

const scheduleRenewal = (context, expiration) => {

    return context.setTimeout({}, Math.max(expiration - Date.now() - RENEW_BEFORE_MS, MIN_TIMEOUT_MS));
};

/**
 * Create the subscription and remember what it takes to renew or rebuild it. Does not
 * schedule the renewal - the caller decides, so a rebuild does not add a second timer.
 * @param {object} context
 * @param {string} resource - Graph resource to watch, e.g. `/chats/{id}/messages`
 * @param {string} changeType
 * @return {Promise<Date>} the new expiration
 */
const createSubscription = async (context, resource, changeType) => {

    const expiration = expiresAt();
    // A per-flow secret. Every notification carries it back, so anything that did not come
    // from this subscription is dropped.
    const clientState = crypto.randomBytes(16).toString('hex');
    const webhookUrl = context.getWebhookUrl();

    const { data } = await makeRequest(context, {
        method: 'POST',
        path: '/subscriptions',
        data: {
            changeType,
            resource,
            notificationUrl: webhookUrl,
            // Lifecycle events arrive on the same URL; `lifecycleEvent` tells them apart.
            lifecycleNotificationUrl: webhookUrl,
            expirationDateTime: expiration.toISOString(),
            clientState
        }
    });

    await context.stateSet('subscriptionId', data.id);
    await context.stateSet('clientState', clientState);
    await context.stateSet('resource', resource);
    await context.stateSet('changeType', changeType);

    return expiration;
};

/**
 * Push the expiry out. Returns null when Graph no longer knows the subscription.
 * @param {object} context
 * @param {string} subscriptionId
 * @return {Promise<Date|null>}
 */
const patchExpiration = async (context, subscriptionId) => {

    const expiration = expiresAt();

    try {
        await makeRequest(context, {
            method: 'PATCH',
            path: `/subscriptions/${encodeURIComponent(subscriptionId)}`,
            data: { expirationDateTime: expiration.toISOString() }
        });
    } catch (error) {
        if (statusOf(error) === 404) {
            return null;
        }
        throw error;
    }

    return expiration;
};

module.exports = {

    LIFETIME_MS,
    RENEW_BEFORE_MS,

    /**
     * Subscribe and schedule the first renewal.
     * @param {object} context
     * @param {object} options
     * @param {string} options.resource
     * @param {string} [options.changeType]
     * @return {Promise<*>}
     */
    async start(context, { resource, changeType = 'created' }) {

        const expiration = await createSubscription(context, resource, changeType);
        return scheduleRenewal(context, expiration);
    },

    /**
     * Renew and re-arm. Renewals are a self-perpetuating chain of timeouts, so a subscription
     * Graph has dropped (404) is rebuilt rather than left to make the trigger silent forever.
     * @param {object} context
     * @return {Promise<*>}
     */
    async renew(context) {

        const subscriptionId = await context.stateGet('subscriptionId');
        const resource = await context.stateGet('resource');
        const changeType = await context.stateGet('changeType') || 'created';

        const expiration = subscriptionId ? await patchExpiration(context, subscriptionId) : null;

        return scheduleRenewal(context, expiration || await createSubscription(context, resource, changeType));
    },

    /**
     * Answer the endpoint-validation handshake.
     * https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
     * @param {object} context
     * @return {boolean} true when the request was the handshake and carries no notifications
     */
    isValidation(context) {

        const validationToken = context.messages.webhook.content.query?.validationToken;
        if (!validationToken) {
            return false;
        }

        context.response(validationToken, 200, { 'Content-type': 'text/plain' });
        return true;
    },

    /**
     * Whether the notification came from the subscription this flow created.
     * @param {object} context
     * @param {object} notification
     * @return {Promise<boolean>}
     */
    async isOurs(context, notification) {

        return notification?.clientState === await context.stateGet('clientState');
    },

    /**
     * Keep the subscription alive across the events Graph raises on its own.
     * @param {object} context
     * @param {object} notification
     * @return {Promise<boolean>} true when this was a lifecycle event, not a change
     */
    async handleLifecycle(context, notification) {

        const event = notification.lifecycleEvent;
        if (!event) {
            return false;
        }

        const subscriptionId = await context.stateGet('subscriptionId');
        const rebuild = async () => {

            await createSubscription(
                context,
                await context.stateGet('resource'),
                await context.stateGet('changeType') || 'created'
            );
        };

        if (event === 'reauthorizationRequired') {
            // The access behind the subscription has to be confirmed again. Reauthorizing
            // keeps the subscription id, so the pending renewal timer stays valid.
            try {
                await makeRequest(context, {
                    method: 'POST',
                    path: `/subscriptions/${encodeURIComponent(subscriptionId)}/reauthorize`
                });
                if (!await patchExpiration(context, subscriptionId)) {
                    await rebuild();
                }
            } catch (error) {
                if (statusOf(error) !== 404) {
                    throw error;
                }
                await rebuild();
            }
        } else if (event === 'subscriptionRemoved') {
            await rebuild();
        } else {
            // 'missed': Graph could not deliver some notifications. There is nothing to fetch
            // from the event itself, so record it - the messages it covered are lost.
            await context.log({ step: 'Change notifications were missed', event, subscriptionId });
        }

        return true;
    },

    /**
     * Delete the subscription. A subscription Graph already dropped is not an error.
     * @param {object} context
     * @return {Promise<void>}
     */
    async stop(context) {

        const subscriptionId = await context.stateGet('subscriptionId');
        if (!subscriptionId) {
            return;
        }

        try {
            await makeRequest(context, {
                method: 'DELETE',
                path: `/subscriptions/${encodeURIComponent(subscriptionId)}`
            });
        } catch (error) {
            if (statusOf(error) !== 404) {
                throw error;
            }
        }

        await context.stateUnset('subscriptionId');
    }
};
