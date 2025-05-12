'use strict';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Token',
                tooltip: 'Enter your API Token.'
            },
            'regionPrefix': {
                type: 'text',
                name: 'Region',
                tooltip: 'Type "nexl-360-latest" if your account URL is "https://nexl-360-latest.nexl.cloud/company/<companyID>".'
            }
        },

        accountNameFromProfileInfo: (context) => {
            const apiKey = context.apiKey;
            return apiKey.substr(0, 6) + '...' + apiKey.substr(-6);
        },

        validate: async (context) => {
            const response = await context.httpRequest({
                method: 'POST',
                url: `https://${context.regionPrefix}.nexl.cloud/api/graphql`,
                headers: {
                    Authorization: `Bearer ${context.apiKey}`
                },
                data: {
                    query: 'query AccessRoles { accessRoles { entries { description id isPersisted name updatedAt } } }'
                }
            });
            return response.status;
        }
    }
};
