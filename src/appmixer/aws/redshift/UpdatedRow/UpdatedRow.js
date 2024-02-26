'use strict';

const { runQuery } = require('../common');

module.exports = {
    async tick(context) {

        const { query, updatedDateColumn, primaryKey } = context.properties;
        let { lastUpdated } = await context.stateGet('lastUpdated') || {};
        let processedKeys = await context.stateGet('processedKeys') || {};

        try {
            if (!lastUpdated) {
                // On first tick, fetch only the most recent update to set lastUpdated
                const latestRowQuery = `${query} ORDER BY ${updatedDateColumn} DESC LIMIT 1`;
                const latestRowResult = await runQuery({ context: context.auth, query: latestRowQuery });
                lastUpdated = latestRowResult.rows.length
                    ? latestRowResult.rows[0][updatedDateColumn]
                    : 0;

                await context.stateSet('lastUpdated', { lastUpdated });
            } else {
                const updatedRows = await this.checkForUpdatedRows(context, query, updatedDateColumn, lastUpdated);
                for (const row of updatedRows) {

                    if (!primaryKey || !processedKeys[row[primaryKey]]) {
                        await context.sendJson({ row }, 'out');
                        if (primaryKey) {
                            processedKeys[row[primaryKey]] = true; // Mark this key as processed
                        }
                    }
                }

                if (updatedRows.length > 0) {
                    // Update lastUpdated and processedKeys
                    lastUpdated = updatedRows[updatedRows.length - 1][updatedDateColumn];
                    await context.stateSet('lastUpdated', lastUpdated);
                    if (primaryKey) {
                        await context.stateSet('processedKeys', processedKeys);
                    }
                }
            }
        } catch (error) {
            throw new context.CancelError('Error executing query: ' + error);
        }
    },

    async checkForUpdatedRows(context, query, updatedDateColumn, lastUpdated) {

        const updatedQuery = `${query} WHERE ${updatedDateColumn} > $1 ORDER BY ${updatedDateColumn} ASC`;
        const queryResponse = await runQuery({ context: context.auth, query: updatedQuery, params: [lastUpdated] });
        return queryResponse.rows;
    }
};
