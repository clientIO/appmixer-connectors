'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

// v2 /search does not support comparators on date fields, hence the version override.
const makeClient = (context) => new ZohoClient(context, undefined, { apiVersion: lib.SEARCH_API_VERSION });

/**
 * Invoices due in [fromDate, toDate] that are not in the excluded status. Shared by tick() and
 * test() so Flow Test Mode samples exactly what the trigger emits.
 * @param {Object} context
 * @param {string|null} fromDate YYYY-MM-DD, or null for no lower bound.
 * @param {string} toDate YYYY-MM-DD
 */
const overdueCriteria = (context, fromDate, toDate) => {

    const { excludeStatus } = context.properties;
    return lib.buildCriteria([
        fromDate ? `(Due_Date:greater_equal:${fromDate})` : null,
        `(Due_Date:less_equal:${toDate})`,
        excludeStatus ? `(Status:not_equal:${lib.escapeCriteriaValue(excludeStatus)})` : null
    ]);
};

/**
 * Polls the Invoices module for invoices that have just become overdue. Each tick looks at the due
 * dates that elapsed between the previous run and yesterday, so an invoice is reported exactly
 * once. The first tick only records the watermark so that already overdue invoices are not
 * replayed into the flow. "Today" is the connected user's calendar day, not the UTC one.
 */
module.exports = {

    async tick(context) {

        const today = lib.startOfToday(lib.userTimeZone(context));
        const todayDate = lib.formatDate(today);
        const lastDate = await context.stateGet('lastDate');

        if (!lastDate) {
            return context.stateSet('lastDate', todayDate);
        }
        if (lastDate >= todayDate) {
            return;
        }

        const criteria = overdueCriteria(context, lastDate, lib.formatDate(lib.addDays(today, -1)));
        const records = await makeClient(context).search('Invoices', { criteria });

        for (const record of records) {
            await context.sendJson(record, 'out');
        }

        return context.stateSet('lastDate', todayDate);
    },

    async test(context) {

        const yesterday = lib.formatDate(lib.addDays(lib.startOfToday(lib.userTimeZone(context)), -1));
        const record = await lib.searchFirst(makeClient(context), 'Invoices', {
            criteria: overdueCriteria(context, null, yesterday)
        });

        if (!record) {
            throw new context.CancelError(
                'No overdue invoices (due date in the past, not in the excluded status) found to use as test data. ' +
                'The trigger fires the day after an invoice\'s due date has passed.'
            );
        }

        return context.sendJson(record, 'out');
    }
};
