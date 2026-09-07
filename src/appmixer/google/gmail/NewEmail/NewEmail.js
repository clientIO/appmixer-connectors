'use strict';
const emailCommons = require('../lib');

module.exports = {

    async tick(context) {

        const { query } = context.properties;
        const state = context.state;
        const { emails, state: newState } = await emailCommons.listNewMessages(context, query, state);

        await context.sendArray(emails, 'out');
        if (JSON.stringify(state != JSON.stringify(newState))) {
            return context.saveState(newState);
        }
    },

    // Flow Test Mode: emit one realistic email without starting the flow.
    // Thin wrapper over the same lib helpers tick() uses (fetchMessage/normalizeEmail) — the
    // only difference is it fetches the latest message matching `query` and touches no state.
    async test(context) {

        const { query } = context.properties;
        const email = await emailCommons.fetchLatestExample(context, query);
        if (!email) {
            throw new Error('No recent emails matching the query to use as test data.');
        }
        return context.sendJson(email, 'out');
    }
};
