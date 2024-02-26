'use strict';
const merk = require('../../merk-commons');

module.exports = {

    async tick(context) {

        let subscriptions = await merk.get('/subscriptions/', context.auth.apiKey, {});
        let known = context.state.known;
        if (JSON.stringify(known) !== JSON.stringify(subscriptions)) {
            await context.sendJson(subscriptions, 'subscription');
            await context.saveState({ known: subscriptions });
        }
    }
};
