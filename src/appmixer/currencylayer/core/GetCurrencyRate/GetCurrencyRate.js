'use strict';

module.exports = {

    async receive(context) {

        const currencyPair = context.messages.in.content.currencyPair;
        const REQUEST_URL = `https://api.apilayer.com/currency_data/live?source=${currencyPair.slice(0, 3)}&currencies=${currencyPair.slice(3)}`;
        const response = await context.httpRequest({
            method: 'GET',
            url: REQUEST_URL,
            json: true,
            headers: {
                'apikey': context.auth.apiKey
            }
        });

        const out = {
            currencyPair,
            rate: response.data.quotes[currencyPair]
        };

        return context.sendJson(out, 'out');
    }
};

