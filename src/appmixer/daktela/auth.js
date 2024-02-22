'use strict';

module.exports = {

    type: 'apiKey',

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

            console.log('requestProfileInfo');
            const { result } = await daktelaWhoim(context);
            console.log('user', result);
            return { name: result.user.title || result.user.alias };
        },

        accountNameFromProfileInfo: 'name',

        validate: async context => {

            console.log('validate');
            await daktelaWhoim(context);

            return;
        }
    }
};

async function daktelaWhoim(context) {

    const { data } = await context.httpRequest({
        url: `https://${context.instance}.daktela.com/api/v6/login.json`,
        method: 'POST',
        data: {
            username: context.username,
            password: context.password
        }
    });

    return data;
}
