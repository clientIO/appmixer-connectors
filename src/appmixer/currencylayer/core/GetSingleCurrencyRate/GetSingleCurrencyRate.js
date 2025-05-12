'use strict';
const { fetchData } = require('../commons');

module.exports = {
    async receive(context) {
        const params = {
            source: context.messages.in.content.source,
            currencies: context.messages.in.content.target
        };
        const data = await fetchData(context, 'live', params);
        const result = data.quotes;
        const currencyPair = Object.keys(result)[0];
        const currencyRate = {
            rate: result[currencyPair],
            currencyPair: currencyPair
        };

        return context.sendJson(currencyRate, 'out');
    }
};
