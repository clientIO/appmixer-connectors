'use strict';

module.exports = {

    async start(context) {

        let properties = context.properties;
        let auth = context.auth;
        let state = context.state;
        // modify state
        state.started = new Date();
        // save state
        context.state = state;
    }
};
