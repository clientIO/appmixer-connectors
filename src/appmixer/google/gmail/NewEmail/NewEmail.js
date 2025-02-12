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
    }
};
