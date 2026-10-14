'use strict';
const commons = require('../microsoft-commons');
const baseUrl = 'https://graph.microsoft.com/v1.0';

// Graph throttles Teams at 1 rps per chat/channel, so a quick run of paged requests can
// hit 429. Retry a few times, honouring Retry-After (capped so a lock is not held long).
const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_SECONDS = 10;

const getRetryAfterMs = (error) => {

    const seconds = Number(error.response?.headers?.['retry-after']);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, MAX_RETRY_AFTER_SECONDS) * 1000 : 1000;
};

module.exports = {

    async makeRequest(context, options) {

        for (let attempt = 0; ; attempt++) {
            try {
                return await context.httpRequest({
                    url: options.url || `${baseUrl}${options.path}`,
                    method: options.method,
                    data: options.data,
                    params: options.params,
                    headers: {
                        Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                        accept: 'application/json'
                    }
                });
            } catch (error) {
                if (error.response?.status === 429 && attempt < MAX_RETRIES) {
                    await new Promise((resolve) => setTimeout(resolve, getRetryAfterMs(error)));
                    continue;
                }
                throw commons.graphError(error);
            }
        }
    }
};
