'use strict';

const commons = require('../microsoft-commons');
const baseUrl = 'https://graph.microsoft.com/v1.0';

module.exports = {

    async makeRequest(context, options) {

        try {
            return await context.httpRequest({
                url: options.url || `${baseUrl}${options.path}`,
                method: options.method,
                data: options.data,
                params: options.params,
                headers: {
                    Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                    accept: 'application/json',
                    // Caller-supplied headers (e.g. Prefer: outlook.timezone) extend/override the defaults.
                    ...options.headers
                }
            });
        } catch (error) {
            throw commons.graphError(error);
        }
    },

    /** Time before expiration to renew the subscription. */
    renewBeforeExpirationMs: 1000 * 60 * 5,

    /**
     * Maximum expiration for calendar event change notification subscriptions is
     * 4230 minutes (less than 3 days). We renew well before that to stay on the safe side.
     * See https://docs.microsoft.com/en-us/graph/api/resources/subscription#maximum-length-of-subscription-per-resource-type.
     * @return {Date}
     */
    getSubscriptionExpirationDateTime() {

        return new Date(Date.now() + 3000 * 60 * 1000);
    },

    /**
     * Read-only fetch of the newest event in the default calendar, ordered by the given field.
     * Returns the full event object (same shape `receive()` forwards after GET /me/events/{id})
     * or null when the calendar is empty. Used only by the triggers' test() methods.
     * @param {Context} context
     * @param {string} orderBy - e.g. 'createdDateTime' or 'lastModifiedDateTime'
     * @return {Promise<object|null>}
     */
    async fetchLatestEvent(context, orderBy) {

        const { data } = await this.makeRequest(context, {
            method: 'GET',
            path: '/me/events',
            params: {
                '$top': 1,
                '$orderby': `${orderBy} desc`
            }
        });
        const events = (data && data.value) || [];
        const listItem = events[0];
        if (!listItem) {
            return null;
        }

        // Re-fetch the event by id so test() emits the SAME shape receive() forwards
        // (GET /me/events/{id}); the listing projection can omit fields.
        const { data: event } = await this.makeRequest(context, {
            method: 'GET',
            path: `/me/events/${listItem.id}`
        });
        return event || listItem;
    }
};
