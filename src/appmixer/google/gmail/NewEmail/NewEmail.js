'use strict';
const emailCommons = require('../gmail-commons');
const Promise = require('bluebird');

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
