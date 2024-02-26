'use strict';
const Webflow = require('webflow-api');

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const token = context.auth.apiKey;
        const client = new Webflow({ token });

        return client.sites()
            .then(sites => {
                return context.sendJson(sites, 'out');
            });
    }
};

