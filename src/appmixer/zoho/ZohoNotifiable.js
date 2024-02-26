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
};
