'use strict';
const { fetchData } = require('../commons');
module.exports = {
    async receive(context) {
        const data = await fetchData(context, 'list');
        {
            let result = data.currencies;
            const currencies = Object.keys(result).map(currency=>{
                return {
                    'CurrencyName': `${result[currency]} (${currency})`,
                    'Abbreviation': currency
                };

            }
            );
            return context.sendJson({ currencies }, 'out');
        }

    },

    currencyPairsToSelectArray({ currencies }) {

        return currencies.map(name => {
            return { label: `${name.CurrencyName}`, value: `${name.Abbreviation}` };
        });
    }
};
