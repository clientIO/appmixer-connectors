const lib = require("../lib");
module.exports = {

    async start(context) {

        await context.saveState({
            expirationTime: Date.now() + 60 * 50 * 1000 // 50 minutes
        });

    },

    stop(context) {

    },

    async receive(context) {

        return context.response();
    },

    async tick(context) {

        const { accessToken } = context.auth;
        const state = await context.loadState();
        const { expirationTime } = state;
        const now = Date.now();

        if (now >= expirationTime) {

            const newExpirationTime = expirationTime + 60 * 61 * 1000;
            await context.log({
                'step': 'token info ' + accessToken.substr(accessToken.length - 10),
                expirationTime: new Date(expirationTime),
                a: context.auth
            });

            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://www.googleapis.com/oauth2/v2/userinfo',
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            await context.log({ 'step': 'test rq', response: response.data });

            await context.saveState({
                expirationTime: newExpirationTime
            });
        }

    }
};
