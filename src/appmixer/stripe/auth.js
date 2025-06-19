'use strict';

module.exports = {
    type: 'apiKey',

    definition: {
        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'To generate, go to Developers > API Keys in your Stripe dashboard.'
            }
        },

        async getUserProfile(context) {
            const apiKey = context.apiKey;

            const response = await context.httpRequest({
                url: 'https://api.stripe.com/v1/account',
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            });

            return response.data;
        },

        async requestProfileInfo(context) {
            const data = await this.getUserProfile(context);

            if (data && data.fullName) {
                return { name: data.fullName };
            } else if (data && data.email) {
                return { name: data.email };
            }

            return { name: 'Unknown Stripe User' };
        },

        accountNameFromProfileInfo: 'email',

        async validate(context) {
            return await this.getUserProfile(context);
        }
    }
};
