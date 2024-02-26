'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'apiKey',

        accountNameFromProfileInfo: 'appId',

        auth: {
            appId: {
                type: 'text',
                name: 'OneSignal APP ID',
                tooltip: 'Log into your OneSignal account and find <i>Keys & IDs</i> under your App Settings page.'
            },
            apiKey: {
                type: 'text',
                name: 'REST API Key',
                tooltip: 'Found directly next to your App ID.'
            }
        },

        validate: {
            method: 'GET',
            url: 'https://onesignal.com/api/v1/players?app_id={{appId}}&limit=1',
            headers: {
                'Authorization': 'Basic {{apiKey}}'
            }
        }
    }
};
