'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            id: {
                type: 'text',
                name: 'API ID',
                tooltip: 'Provide your API ID.'
            },
            key: {
                type: 'password',
                name: 'API Key',
                tooltip: 'Provide your API Key.'
            }
        },

        accountNameFromProfileInfo: 'account_name',

        requestProfileInfo: {
            url: 'https://my.imperva.com/api/prov/v1/account',
            method: 'POST',
            headers: {
                'x-API-Id': '{{id}}',
                'x-API-Key': '{{key}}'
            }
        },

        validate: async context => {

            const { data } = await context.httpRequest({
                url: 'https://my.imperva.com/api/prov/v1/account',
                method: 'POST',
                headers: {
                    'x-API-Id': context.id,
                    'x-API-Key': context.key
                }
            });

            if (!data?.account_name) {
                throw new Error(JSON.stringify(data));
            }

            return;
        }
    }
};
