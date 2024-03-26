'use strict';

module.exports = {

    type: 'pwd',

    definition: {

        auth: {
            username: {
                type: 'text',
                name: 'Username',
                tooltip: 'Provide your username.'
            },
            password: {
                type: 'password',
                name: 'Password',
                tooltip: 'Provide your password.'
            },
            instance: {
                type: 'text',
                name: 'Instance',
                tooltip: 'Provide your instance. Example: https://yourcompany.daktela.com'
            }
        },

        requestProfileInfo: async context => {

            const { result } = await daktelaValidate(context);

            return { name: result.user.title || result.user.alias };
        },

        accountNameFromProfileInfo: 'name',

        validate: async context => {

            const { result } = await daktelaValidate(context);

            return { token: result.accessToken };
        }
    }
};

async function daktelaValidate(context) {

    const { data } = await context.httpRequest({
        url: `https://${context.instance || context.auth.instance}.daktela.com/api/v6/login.json`,
        method: 'POST',
        data: {
            // When called from auth.js we have username and password in context.
            // When called from other components we have username and password in context.auth.
            username: context.username || context.auth.username,
            password: context.password || context.auth.password
        }
    });

    return data;
}
