'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your Merk account and find ' +
                    '<i>Your personal API key in the User account section.</i>.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://api.merk.cz:443/',
            headers: {
                'Authorization': 'Token {{apiKey}}'
            }
        }
    }
};
