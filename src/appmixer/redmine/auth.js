'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Enter your API key.'
            },
            'url': { type: 'text', name: 'url', tooltip: 'Redmine URL' }
        },
        // TODO: hide key partialy. Also show domain
        accountNameFromProfileInfo: 'apiKey',

        replaceVariables(context, str) {
            Object.keys(this.auth).forEach(variableName => {
                str = str.replaceAll('{' + variableName + '}', context[variableName]);
            });
            return str;
        },

        validate: context => {
            return true;
        }
    }
};
