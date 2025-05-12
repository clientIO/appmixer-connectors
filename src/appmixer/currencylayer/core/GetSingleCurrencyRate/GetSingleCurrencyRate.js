'use strict';
const { fetchData } = require('../commons');

module.exports = {
    async receive(context) {
        const params = {
            source: context.messages.in.content.source,
            currencies: context.messages.in.content.target
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
            } else {
                // If the error is not 106, stop retrying and throw an error
                throw new context.CancelError(`API returned error: ${data.error?.code || 'unknown error'}`);
            }
        }

        // If we retried 3 times and still got no success, throw error
        if (!data.success) {
            throw new context.CancelError('API failed after 3 retries');
        }

        const result = data.quotes;
        const currencyPair = Object.keys(result)[0];
        const currencyRate = {
            rate: result[currencyPair],
            currencyPair: currencyPair
        };

        return context.sendJson(currencyRate, 'out');
    }
};
