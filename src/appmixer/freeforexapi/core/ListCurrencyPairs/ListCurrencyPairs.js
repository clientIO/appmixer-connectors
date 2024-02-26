'use strict';

module.exports = {

    async receive(context) {

        const REQUEST_URL = 'https://www.freeforexapi.com/api/live';
        const response = await context.httpRequest({
            method: 'GET',
            url: REQUEST_URL,
            json: true
        });

        const out = response.data;
        return context.sendJson(out, 'out');
    },

    currencyPairsToSelectArray(pairs = {}) {

        let transformed = [];
        pairs.supportedPairs.map(pair => {

            const label = pair.match(/.{1,3}/g).join('-');
            transformed.push({ label: label, value: pair });
        });
        return transformed;
    }
};

