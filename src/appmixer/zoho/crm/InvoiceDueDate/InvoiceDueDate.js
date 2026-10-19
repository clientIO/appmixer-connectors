'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

// v2 /search does not support comparators on date fields, hence the version override.
const makeClient = (context) => new ZohoClient(context, undefined, { apiVersion: lib.SEARCH_API_VERSION });

/**
 * The due date the trigger is looking for: the connected user's today plus `daysBefore`.
 * Shared by tick() and test().
 */
const targetDueDate = (context) => {

    const daysBefore = Number(context.properties.daysBefore) || 0;
    return lib.formatDate(lib.addDays(lib.startOfToday(lib.userTimeZone(context)), daysBefore));
};

/**
 * Polls the Invoices module for invoices reaching their due date. The target due date moves once a
 * day. Every tick re-reads the invoices due on the target date and emits the ones not reported yet
 * for that date, so an invoice created (or re-dated) later in the day still fires, exactly once.
 * When the target date moves by more than one day (the flow was not ticking), the skipped due
 * dates are caught up in the same search.
 */
module.exports = {

    async tick(context) {

        const targetDate = targetDueDate(context);
        const { date: lastDate, ids: reportedIds = [] } = (await context.stateGet('dueDate')) || {};

        const fromDate = lastDate && lastDate < targetDate
            ? lib.formatDate(lib.addDays(lastDate, 1))
            : targetDate;
        const criteria = fromDate === targetDate
            ? `(Due_Date:equals:${targetDate})`
            : lib.buildCriteria([
                `(Due_Date:greater_equal:${fromDate})`,
                `(Due_Date:less_equal:${targetDate})`
            ]);

        const records = await makeClient(context).search('Invoices', { criteria });

        const reported = new Set(lastDate === targetDate ? reportedIds : []);
        for (const record of records) {
            if (reported.has(record.id)) {
                continue;
            }
            reported.add(record.id);
            await context.sendJson(record, 'out');
        }

        return context.stateSet('dueDate', { date: targetDate, ids: [...reported] });
    },

    async test(context) {

        const targetDate = targetDueDate(context);
        const record = await lib.searchFirst(makeClient(context), 'Invoices', {
            criteria: `(Due_Date:equals:${targetDate})`
        });

        if (!record) {
            throw new context.CancelError(
                `No invoices due on ${targetDate} found to use as test data. ` +
                'Set an invoice\'s due date to that day, or change "Days Before", to get a sample.'
            );
        }

        return context.sendJson(record, 'out');
    }
};
