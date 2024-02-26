'use strict';
const BASE_URL = 'https://api.exchangerate.host';

module.exports = {

    async receive(context) {

        const message = context.messages.in.content;

        let url = context.config.BASE_URL || BASE_URL;
        url += '/' + (message.date || 'latest');

        url += '?';
        if (message.base) {
            url += '&base=' + message.base;
        }
        if (message.symbol) {
            url += '&symbols=' + message.symbol;
        }

        const response = await context.httpRequest({
            method: 'GET',
            url,
            json: true
        });

        const rates = response.data;

        const out = {
            rates: rates.rates,
            base: rates.base,
            date: rates.date
        };

        if (message.symbol) {
            out.rate = rates.rates[message.symbol];
        }

        return context.sendJson(out, 'out');
    },

    ratesToSelectArray(rates = []) {

        return Object.keys(rates.rates).map(symbol => {
            return {
                label: symbol,
                value: symbol
            };
        });
    }
};
