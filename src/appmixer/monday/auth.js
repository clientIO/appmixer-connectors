/* eslint-disable max-len */
'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'The API key can be found by clicking on your profile picture, opening the Developers section. Then, click on Developers in the header menu and select My Access Tokens to get your personal API token.'
            }
        },

        accountNameFromProfileInfo: 'data.me.name',

        requestProfileInfo: async context => {

            const user = await context.httpRequest({
                url: 'https://api.monday.com/v2',
                method: 'POST',
                data: {
                    query: 'query { me { is_guest created_at name id } }'
                },
                headers: {
                    'Authorization': context.apiKey
                }
            });
            return user.data;
        },

        validate: async context => {

            await context.httpRequest({
                url: 'https://api.monday.com/v2',
                method: 'POST',
                data: {
                    query: 'query { me { is_guest created_at name id } }'
                },
                headers: {
                    'Authorization': context.apiKey
                }
            });
            return true;
        }
    }
};
