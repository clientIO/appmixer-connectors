'use strict';

const { runQuery } = require('../common');


module.exports = {

    async start(context) {

        await context.stateSet('ignoreNextTick', true);
    },
    async tick(context) {

        const { query, compareField: field } = context.properties;
        let lastSeenValue = await context.stateGet('lastSeenValue');

        const sanitizedQuery = query.replace(';', '');

        try {
            if (lastSeenValue === null) {
                // On the first run, query only the latest row to set the lastSeenValue
                const latestRowQuery = `${sanitizedQuery} ORDER BY ${field} DESC LIMIT 1`;
                const latestRowResult = await runQuery({ context: context.auth, query: latestRowQuery });
                lastSeenValue = latestRowResult.rows.length ? latestRowResult.rows[0][field] : 0;
                await context.stateSet('lastSeenValue', lastSeenValue);
            } else {
                const newRows = await this.checkForNewRows(context, sanitizedQuery, field, lastSeenValue);
                if (newRows.length) {
                    const lastValue = newRows[newRows.length - 1][field];
                    for (const row of newRows) {
                        await context.sendJson({ row }, 'out');
                    }
                    await context.stateSet('lastSeenValue', lastValue);
                }
            }
        } catch (error) {
            throw new context.CancelError('Error executing query: ' + error);
        }
    },
    /**
     * Asynchronously checks for new rows in a database table based on a given query and field.
     *
     * @param {Object} context - The context object.
     * @param {string} query - The SQL query to be executed.
     * @param {string} field - The field in the table to compare against.
     * @param {any} lastSeenValue - The last value seen for the given field.
     * @return {Promise<Array>} The array of rows returned by the query.
     */
    async checkForNewRows(context, query, field, lastSeenValue) {

        const updatedQuery = `${query} WHERE ${field} > ${lastSeenValue} ORDER BY ${field}`;
        const queryResponse = await runQuery({ context: context.auth, query: updatedQuery });
        return queryResponse.rows;

    }
};
