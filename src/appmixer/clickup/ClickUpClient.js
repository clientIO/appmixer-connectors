'use strict';

class ClickUpClient {

    /**
     * @param {*} context Component context
     */
    constructor(context) {

        this.log = context.log;

        // context.auth.accessToken for component calls
        // context.accessToken for calls from auth.js
        const accessToken = context.auth?.accessToken || context.accessToken;

        if (!accessToken) {
            throw new context.CancelError('Missing accessToken.');
        }

        this.client = context.httpRequest.create({
            baseURL: 'https://api.clickup.com/api/v2',
            timeout: 6 * 1000,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'AppMixer'
            }
        });
    }

    /**
     * @param {string} method GET, POST, PUT, DELETE
     * @param {string} url Partial URL, e.g. /list
     * @param {object} params
     * @param {string} params.dataKey Key of the data array in the response.
     * Eg. 'tasks' for /tasks. If not provided, the last part of the URL is used.
     * @param {number} params.countLimit Maximum number of records to return. Default 10000.
     * @param {object} params.data Request body. Valid for POST and PUT only.
     * @param {object} params.headers Request headers
     * @param {object} params.params Request query parameters
     * @returns {Promise<object[]>} Array of records
     */
    async requestPaginated(method, url, { dataKey, countLimit = 10000, data, headers = {}, params = {}, paramsSerializer = {} } = {}) {

        let records = [];
        const key = dataKey || url.split('/').pop();
        let hasMoreRecords = false;
        let page = -1;
        do {
            page += 1;
            params.page = page;

            const response = await this.request(method, url, { data, headers, params, paramsSerializer });
            if (response && response[key]) {
                const results = response[key];
                hasMoreRecords = !response['last_page'];
                records = records.concat(results);
            }
        } while (hasMoreRecords && records.length < countLimit);
        return records;
    }

    async request(method, url, { data, headers = {}, params = {}, paramsSerializer } = {}) {

        const request = {
            method,
            url,
            headers,
            data,
            params,
            paramsSerializer

        };
        this.log({ step: 'ClickUpClient.request', request });
        return this.client(request)
            .then(response => {
                return response.data;
            })
            .catch(e => {
                if (e.response && e.response.data) {
                    if (Array.isArray(e.response.data)) {
                        const errorData = e.response.data[0];
                        throw errorData;
                    }
                    throw e.response.data;
                }
                throw e;
            });
    }
}

module.exports = ClickUpClient;
