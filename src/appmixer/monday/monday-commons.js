// 'use strict';
const mondaySdk = require('monday-sdk-js');
const queries = require('./queries');

module.exports = {

    async makeRequest({ query, options, apiKey }) {

        const monday = mondaySdk();
        monday.setApiVersion('2024-01');
        monday.setToken(apiKey);

        const {
            data,
            errors,
            error_message: errorMessage
        } = await monday.api(query, options);

        if (errors) {
            throw new Error(`Error fetching: ${errors[0].message || JSON.stringify(errors)}`);
        }
        if (errorMessage) {
            throw new Error(`Failure fetching: ${errorMessage}`);
        }

        return data;
    },

    /**
     * Fetch the most recent (newest) item on the configured board via the read-only GraphQL API.
     * Shared by the item webhook triggers' test() methods (Flow Test Mode) to produce a realistic
     * example without registering a webhook. Read-only, touches no state. Returns null if the
     * board has no items.
     * @param {Context} context
     * @returns {Promise<object|null>} raw monday item (id, name, group, column_values)
     */
    async fetchLatestItem(context) {

        const boardId = +(context.properties.boardId);
        const data = await this.makeRequest({
            query: queries.latestBoardItem,
            options: { variables: { boardId } },
            apiKey: context.auth.apiKey
        });

        const board = (data && data.boards && data.boards[0]) || null;
        const items = (board && board.items_page && board.items_page.items) || [];
        return items[0] || null;
    },

    /**
     * Reshape a fetched monday item into the webhook `event` body that the item triggers'
     * receive() forwards on the 'out' port. Single source of truth for the webhook event shape,
     * shared by every monday item webhook trigger's test().
     *
     * The monday webhook delivers an `event` object whose `type` differs per subscription
     * (create_pulse / archive_pulse / delete_pulse). The create_item event additionally carries
     * the full group + columnValues; archive/delete events carry only itemId/itemName.
     *
     * @param {Context} context
     * @param {object} item - raw item from fetchLatestItem()
     * @param {string} type - one of 'create_pulse', 'archive_pulse', 'delete_pulse'
     * @returns {object} the webhook `event` body
     */
    toWebhookEvent(context, item, type) {

        const boardId = +(context.properties.boardId);
        const profileInfo = context.auth.profileInfo || {};
        const me = (profileInfo.data && profileInfo.data.me) || {};
        const base = {
            userId: me.id ? +(me.id) : null,
            originalTriggerUuid: null,
            boardId,
            app: 'monday',
            type,
            triggerTime: new Date().toISOString(),
            subscriptionId: null,
            triggerUuid: null
        };

        if (type === 'create_pulse') {
            const columnValues = {};
            (item.column_values || []).forEach(cv => {
                columnValues[cv.id] = {
                    value: cv.value !== undefined ? cv.value : null,
                    text: cv.text !== undefined ? cv.text : null
                };
            });
            const group = item.group || {};
            return Object.assign(base, {
                pulseId: +(item.id),
                pulseName: item.name,
                groupId: group.id || null,
                groupName: group.title || null,
                groupColor: group.color || null,
                isTopGroup: true,
                columnValues
            });
        }

        // archive_pulse / delete_pulse
        return Object.assign(base, {
            itemId: +(item.id),
            itemName: item.name
        });
    }
};
