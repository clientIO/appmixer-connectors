'use strict';
const mandrill = require('mandrill-api/mandrill');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter Mandrill API key.'
            }
        },

        validate: context => {

            let client = new mandrill.Mandrill(context.apiKey);
            return new Promise((resolve, reject) => {
                client.users.ping({},
                    () => { resolve(); },
                    err => { reject(err); });
            });
        }
    }
};
