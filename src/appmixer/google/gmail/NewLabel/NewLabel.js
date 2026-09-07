'use strict';
const emailCommons = require('../lib');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {
        let newState = {};

        const listLabels = await emailCommons.callEndpoint(context, '/users/me/labels', {
            method: 'GET'
        }).then(response => response.data.labels);

        const knownLabels = new Set(context.state.known || []);
        const currentLabels = [];
        const newLabels = [];

        listLabels.forEach(label => {
            currentLabels.push(label.id);
            if (!knownLabels.has(label.id)) {
                if (context.state.known) { // Only consider it new if state.known is already set
                    newLabels.push(label);
                }
            }
        });

        newState.known = currentLabels;

        await context.saveState(newState);

        if (context.state.known) { // Only send new labels if state.known is already set
            await Promise.map(newLabels, label => {
                return context.sendJson(label, 'out');
            });
        }
    },

    // Flow Test Mode: emit one realistic label without starting the flow. Same list call and
    // item shape as tick(); prefers a user-created label since that's what the trigger
    // detects in production (system labels never appear as "new").
    async test(context) {

        const listLabels = await emailCommons.callEndpoint(context, '/users/me/labels', {
            method: 'GET'
        }).then(response => response.data.labels || []);

        const sample = listLabels.filter(label => label.type === 'user').pop() || listLabels.pop();
        if (!sample) {
            throw new Error('No labels to use as test data.');
        }
        return context.sendJson(sample, 'out');
    }
};
