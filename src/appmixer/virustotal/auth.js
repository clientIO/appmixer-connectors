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

        accountNameFromProfileInfo: (context) => {
            const apiKey = context.apiKey;
            return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
        },

        async validate(context) {
            return true;
        }
    }
};
