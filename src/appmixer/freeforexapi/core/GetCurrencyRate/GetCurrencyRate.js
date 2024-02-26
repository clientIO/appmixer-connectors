'use strict';

module.exports = {

    async receive(context) {

        const currencyPair = context.messages.in.content.currencyPair;
        const REQUEST_URL = `https://www.freeforexapi.com/api/live?pairs=${currencyPair}`;

        const response = await context.httpRequest({
            method: 'GET',
            url: REQUEST_URL,
            json: true
        });

        const out = {
            currencyPair,
            rate: response.data.rates[currencyPair].rate
        };

        return context.sendJson(out, 'out');
    }
};

