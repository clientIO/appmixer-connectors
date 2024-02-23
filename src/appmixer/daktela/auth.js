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

            const { result } = await daktelaWhoim(context);

            return { name: result.user.title || result.user.alias };
        },

        accountNameFromProfileInfo: 'name',

        validate: async context => {

            await daktelaWhoim(context);

            return;
        }
    },

    // This function is called in every component to get the access token from the login endpoint.
    getAccessTokenFromLoginEndpoint: async function(context) {

        const cacheKey = `daktela-access-token-${context.username || context.auth.username}`;
        const cachedAccessToken = await context.staticCache.get(cacheKey);
        if (cachedAccessToken) {
            context.log({ step: '--getAccessTokenFromLoginEndpoint', cacheKey, cachedAccessToken });
            return cachedAccessToken;
        }

        const { result } = await daktelaWhoim(context);
        const accessToken = result.accessToken;
        context.log({ step: '++getAccessTokenFromLoginEndpoint', cacheKey, accessToken });

        // Cache the access token so that we don't have to call the login endpoint in every component.
        await context.staticCache.set(
            cacheKey,
            accessToken,
            context.config.accessTokenCacheTTL || (60 * 60 * 24 * 1000) // 24 hours
        );

        return accessToken;
    }
};

async function daktelaWhoim(context) {

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
