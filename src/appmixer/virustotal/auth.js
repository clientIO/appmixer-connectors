'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            'apiKey': {
                'name': 'API Key',
                'type': 'text',
                'tooltip': '<p>Log into your Virustotal account and find your API key.</p>'
            }
        },

        accountNameFromProfileInfo: 'apiKey',

        async validate(context) {
            return true;
        }
    }
};
