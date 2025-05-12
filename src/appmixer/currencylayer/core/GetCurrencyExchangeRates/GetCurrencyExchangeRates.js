'use strict';
const { fetchData } = require('../commons');
const { sendArrayOutput } = require('../commons');
module.exports = {
    async receive(context) {
        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType } = context.messages.in.content;
        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }
        const params = {
            source: context.messages.in.content.source
        };
        const data = await fetchData(context, 'live', params);
        const result = data.quotes;
        const exchangeRates = Object.keys(result).map(currencies=>{
            return {
                'currencyPair':currencies,
                'exchangeRate':result[currencies]
            };
        });
        return await sendArrayOutput({ context, outputType, records: exchangeRates });
    },
    getOutputPortOptions(context, outputType) {

        if (outputType === 'object') {
            return context.sendJson(
                [
                    { label: 'CurrencyPair', value: 'currencyPair' },
                    { label: 'ExchangeRate', value: 'exchangeRate' }

                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    { label: 'Result', value: 'result',
                        schema: { type: 'array',
                            items: { type: 'object',
                                properties: {

                                    currencyPair: { 'label': 'CurrencyPair', 'value': 'currencyPair' },
                                    exchangeRate: { 'label': 'ExchangeRate', 'value': 'exchangeRate' }

                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
