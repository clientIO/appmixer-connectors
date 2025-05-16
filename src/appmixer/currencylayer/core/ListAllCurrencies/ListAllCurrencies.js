'use strict';

const { fetchData } = require('../commons');

module.exports = {
    async receive(context) {
        const cacheKey = 'cl_currencies_' + context.auth.apiKey;
        const { isSource } = context.messages.in.content;

        let lock;

        try {
            lock = await context.lock(context.auth.apiKey);

            // Return cached result if available
            if (isSource) {
                const cached = await context.staticCache.get(cacheKey);
                if (cached) {
                    return context.sendJson({ currencies: cached }, 'out');
                }
            }

            const data = await fetchData(context, 'list');

            if (!data.success) {
                throw new context.CancelError(`API returned error: ${data.error?.code || 'unknown error'}. Please refresh the dropdown input field.`);
            }

            const result = data.currencies;
            const currencies = Object.keys(result).map(currency => ({
                CurrencyName: `${result[currency]} (${currency})`,
                Abbreviation: currency
            }));

            // Save to cache
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    currencies,
                    context.config.currenciesCacheTTL || 20 * 1000 // 20 seconds default
                );
            }

            return context.sendJson({ currencies }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    currencyPairsToSelectArray({ currencies }) {
        return currencies.map(name => ({
            label: `${name.CurrencyName}`,
            value: `${name.Abbreviation}`
        }));
    }
};
