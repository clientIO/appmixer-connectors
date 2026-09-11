'use strict';
const ZohoNotifiable = require('../../ZohoNotifiable');
const lib = require('../lib');

const DEFAULT_CLOSED_STATUS = 'Closed';
// Zoho only reports that a case was edited, not what changed. The last seen Status of every edited
// case is therefore remembered, and the trigger fires only on a transition into the closed status:
// later edits of an already closed case stay silent, while a reopened case that is closed again
// fires again.
const STATUS_TTL = 30 * 24 * 60 * 60 * 1000;

class CaseClosed extends ZohoNotifiable {

    async receive(context) {

        const closedStatus = context.properties.closedStatus || DEFAULT_CLOSED_STATUS;
        const { ids = [] } = context.messages.webhook.content.data || {};
        if (!ids.length) {
            return;
        }
        const records = await this.makeZohoClient(context).getRecords('Cases', {
            params: { ids: ids.join(',') }
        });

        for (const record of records) {
            const cacheKey = `case-closed-status-${context.componentId}-${record.id}`;
            // Two Cases.edit deliveries for the same case can arrive concurrently; without the lock
            // both would read the old status and emit the same closure twice.
            const lock = await context.lock(cacheKey);
            try {
                const previousStatus = await context.staticCache.get(cacheKey);
                await context.staticCache.set(cacheKey, record.Status ?? null, STATUS_TTL);
                if (record.Status === closedStatus && previousStatus !== closedStatus) {
                    await context.sendJson(record, 'out');
                }
            } finally {
                await lock.unlock();
            }
        }
    }

    async test(context) {

        const closedStatus = context.properties.closedStatus || DEFAULT_CLOSED_STATUS;
        const criteria = `(Status:equals:${lib.escapeCriteriaValue(closedStatus)})`;
        const record = await lib.searchFirst(this.makeZohoClient(context), 'Cases', { criteria });

        if (!record) {
            throw new context.CancelError(`No cases with the status "${closedStatus}" found to use as test data.`);
        }

        return context.sendJson(record, 'out');
    }
}

const events = [
    'Cases.edit'
];

/**
 * Component which triggers whenever a case moves into the configured closed status.
 */
module.exports = new CaseClosed(events);
