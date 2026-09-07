'use strict';

const BASE_URL = 'https://latchshot.fly.dev';

module.exports = {

    BASE_URL,

    authHeaders(context) {

        return {
            Authorization: `Bearer ${context.auth.apiKey}`
        };
    },

    apiUrl(value, context) {

        let url;
        try {
            url = new URL(value, BASE_URL);
        } catch (error) {
            throw new context.CancelError('API Endpoint URL is invalid!');
        }

        if (url.origin !== BASE_URL || url.username || url.password) {
            throw new context.CancelError('API Endpoint URL must use https://latchshot.fly.dev.');
        }

        url.hash = '';
        return url.toString();
    },

    optionalIntegerHeader(headers, name) {

        const value = headers?.[name];
        if (value === undefined || value === null || !/^\d+$/.test(String(value))) {
            return undefined;
        }
        return Number(value);
    }
};
