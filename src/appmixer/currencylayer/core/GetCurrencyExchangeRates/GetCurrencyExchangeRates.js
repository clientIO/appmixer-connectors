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
        let retryCount = 0;
        let data;
        // Retry up to 3 times
        while (retryCount < 3) {
            data = await fetchData(context, 'live', params);
            // If the API call is successful, break out of the loop
            if (data.success) {
                break;
            }
            // If the error code is 106, wait for 5 seconds before retrying
            if (data.error?.code === 106) {
                retryCount++;
                if (retryCount < 3) {
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
                }
            }
            else {
                // If the error is not 106, stop retrying and throw an error
                throw new context.CancelError(`API returned error: ${data.error?.code || 'unknown error'}`);
            }
        }
        // If we retried 3 times and still got no success, throw error
        if (!data.success) {
            throw new context.CancelError('API failed after 3 retries');
        }
        // If the API call is successful, process the data
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
