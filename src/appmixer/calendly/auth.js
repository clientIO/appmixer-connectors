'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'data.attributes.email',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Log into your calendly account and find <i>integration</i> page in settings. ' +
                    '<br/>You have to have Premium or Pro Calendly subscription in order make Calendly components work. ' +
                    '<br/>It also works with free 14 days trial.'
            }
        },

        requestProfileInfo: {
            method: 'GET',
            url: 'https://calendly.com/api/v1/users/me',
            headers: {
                'X-TOKEN': '{{apiKey}}'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://calendly.com/api/v1/users/me',
            headers: {
                'X-TOKEN': '{{apiKey}}'
            }
        }
    }
};
