'use strict';
const mandrill = require('mandrill-api/mandrill');
const Promise = require('bluebird');

/**
 * Component for fetching list of templates.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = new mandrill.Mandrill(context.auth.apiKey);

        return new Promise((resolve, reject) => {
            client.templates.list(
                {},
                templates => {
                    context.sendJson(templates, 'templates')
                        .then(() => {
                            resolve();
                        });
                },
                err => {
                    reject(err);
                }
            );
        });
    }
};
