'use strict';
const ZohoClient = require('./ZohoClient');
const moment = require('moment');

module.exports = class ZohoNotifiable {

    constructor(events) {

        this.events = events;
    }

    makeZohoClient(context) {

        return new ZohoClient(context);
    }

    updateState(context, responseEvents) {

        const event = responseEvents.pop();
        // eslint-disable-next-line camelcase
        const { channel_id: channelId, channel_expiry: channelExpiry } = event;
        return context.stateSet('notification', { channelId, channelExpiry });
    }

    async start(context) {

        const url = context.getWebhookUrl();
        const client = this.makeZohoClient(context);
        const { details: { events } } = await client.subscribe(url, this.events);
        return this.updateState(context, events);
    }

    async stop(context) {

        const client = this.makeZohoClient(context);
        const { channelId } = await context.stateGet('notification');
        await client.unsubscribe([channelId]);
        return context.stateUnset('notification');
    }

    async tick(context) {

        const { channelId, channelExpiry } = await context.stateGet('notification');
        const hourBeforeExpiry = moment(channelExpiry).subtract(1, 'hour');
        const timeNow = moment(new Date());

        if (timeNow.isAfter(hourBeforeExpiry)) {
            const client = this.makeZohoClient(context);
            const { details: { events } } = await client.updateNotificationExpiry(channelId, this.events);
            return this.updateState(context, events);
        }
    }

    /**
     * Flow Test Mode helper shared by every CRM notification trigger's test(). Fetches the
     * newest record of `moduleName` via the SAME ZohoClient.getRecords() that ListRecords
     * (and therefore receive()) uses, so the emitted object is identical to a real webhook
     * delivery — only the selection differs (newest-first instead of the webhook's ids).
     * @param {string} moduleName CRM module, e.g. 'Contacts' or 'Leads'.
     * @param {string} [sortBy] field to sort newest-first ('Modified_Time' by default).
     * @returns {Promise<object>} The newest record.
     */
    async fetchLatestExample(context, moduleName, sortBy = 'Modified_Time') {

        const records = await this.makeZohoClient(context).getRecords(moduleName, {
            params: { sort_by: sortBy, sort_order: 'desc', per_page: 1 }
        });
        if (!records || !records.length) {
            throw new context.CancelError(`No ${moduleName} records found to use as test data.`);
        }
        return records[0];
    }
};
