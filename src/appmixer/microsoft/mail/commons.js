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
                    accept: 'application/json'
                }
            });
        } catch (error) {
            throw commons.graphError(error);
        }
    },

    /** Time before expiration to renew the subscription. */
    renewBeforeExpirationMs: 1000 * 60 * 5,

    /**
     * Resolve the messages collection path the trigger watches from its `resource`
     * property. The webhook `resource` points at a messages collection (e.g.
     * "/me/mailfolders('inbox')/messages"); production then fetches the individual
     * message via "/me/messages/{id}". For Flow Test Mode we list that same
     * collection newest-first to obtain a real message in the identical shape.
     * @param {Context} context
     * @return {string}
     */
    resolveMessagesPath(context) {

        return context.properties.resource || "/me/mailfolders('inbox')/messages";
    },

    /**
     * Read-only fetch of the newest message in the watched folder, ordered by the
     * given field. Returns the full message object (same shape `receive()` forwards
     * after GET /me/messages/{id}) or null when the folder is empty. Used only by
     * the triggers' test() methods.
     * @param {Context} context
     * @param {string} orderBy - e.g. 'receivedDateTime' or 'lastModifiedDateTime'
     * @return {Promise<object|null>}
     */
    async fetchLatestMessage(context, orderBy) {

        const path = this.resolveMessagesPath(context);
        const { data } = await this.makeRequest(context, {
            method: 'GET',
            path,
            params: {
                '$top': 1,
                '$orderby': `${orderBy} desc`
            }
        });
        const messages = (data && data.value) || [];
        const listItem = messages[0];
        if (!listItem) {
            return null;
        }

        // Re-fetch the message by id so test() emits the SAME shape receive() forwards
        // (GET /me/messages/{id}); the listing projection can omit fields.
        const { data: message } = await this.makeRequest(context, {
            method: 'GET',
            path: `/me/messages/${listItem.id}`
        });
        return message || listItem;
    }
};
