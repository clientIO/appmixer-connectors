'use strict';
const axios = require('axios');

class Hubspot {

    /**
     * @param {string} [token]
     * @param {Object} options
     * @param {string} [options.apiKey]
     * @param {string} [options.apiKey]
     * @param appId
     */
    constructor(token = '', { apiKey, appId } = {}) {

        this.url = 'https://api.hubapi.com';
        this.setToken(token);
        this.apiKey = apiKey;
        this.appId = appId;
    }

    setToken(token) {

        this.accessToken = token;
    }

    setApiKey(apiKey) {

        this.apiKey = apiKey;
    }

    setAppId(appId) {

        this.appId = appId;
    }

    async call(method, path, data = {}, opts = {}) {

        const payload = {
            method,
            headers: {
                'Authorization': 'Bearer ' + this.accessToken,
                'User-Agent': 'AppMixer'
            }
        };

        if (opts.useKey) {
            delete payload.headers.Authorization;
            opts.query = `hapikey=${this.apiKey}${opts.query ? `&${opts.query}` : ''}`;
        }

        if (method.toLowerCase() === 'get') {
            payload.params = data;
        } else {
            payload.data = data;
        }

        const url = `${this.url}/${path}`.concat(opts.query ? `?${opts.query}` : '');
        try {
            return await axios(url, payload);
        } catch (e) {
            if (e.response && e.response.data && e.response.data.message) {
                const error = new Error(e.response.data.message);
                error.status = e.response.status;
                error.data = e.response.data;
                throw error;
            }
            throw e;
        }
    }

    async accumulativeCall(times, callFn, assembler) {

        const promises = [];

        for (let i = 0; i < times; i++) {
            const p = callFn(i);
            promises.push(p);
        }

        const data = await Promise.all(promises);

        return assembler(data);
    }

    async paginatedCall(method, url, data = {}, recordLimit = 100) {

        let records = [];
        data.limit = Math.min(recordLimit, 500);
        let after = null;
        do {
            data.after = after;
            const response = await this.call(method, url, data);
            const { results, paging } = response.data;
            after = paging && paging.next ? paging.next.after : null;
            records = records.concat(results);
        } while (after && records.length < recordLimit);
        return records;
    }

    registerWebhook(targetUrl) {

        const payload = {
            targetUrl,
            throttling: {
                period: 'SECONDLY',
                maxConcurrentRequests: 25
            }
        };
        return this.call(
            'PUT',
            `webhooks/v3/${this.appId}/settings`,
            payload,
            { useKey: true }
        );
    }
}

module.exports = Hubspot;
