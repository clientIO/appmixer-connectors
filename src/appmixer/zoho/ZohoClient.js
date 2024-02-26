/* eslint-disable camelcase */
'use strict';
const moment = require('moment');
const check = require('check-types');
const { apiEndpoint } = require('./endpoints');

class ZohoClient {

    /**
     * @param {*} context Component context
     * @param {string} [regionAuth] Region from global variable in auth.js
     */
    constructor(context, regionAuth) {

        // context.auth.accessToken for component calls
        // context.accessToken for calls from auth.js
        const accessToken = context.auth?.accessToken || context.accessToken;
        const region = context.profileInfo?.region || regionAuth;

        check.assert.string(accessToken, `Missing accessToken: ${accessToken}.`);
        check.assert.string(region, `Missing region: ${region}.`);

        const apiUrl = apiEndpoint(region);
        this.client = context.httpRequest.create({
            baseURL: apiUrl,
            timeout: 6 * 1000,
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`,
                'User-Agent': 'AppMixer'
            }
        });
    }

    async getFields(moduleName) {

        const { fields } = await this.request(
            'GET',
            '/crm/v2/settings/fields',
            { params: { module: moduleName } }
        );
        return fields;
    }

    async getRecords(moduleName, { params = {} } = {}) {

        return this.requestPaginated(
            'GET',
            `/crm/v2/${moduleName}`,
            { dataKey: 'data', params }
        );
    }

    async getRecord(moduleName, id) {

        return this.executeBulkRequest(
            'GET',
            `/crm/v2/${moduleName}/${id}`, 'data'
        );
    }

    async deleteRecord(moduleName, id) {

        return this.executeBulkRequest(
            'DELETE',
            `/crm/v2/${moduleName}/${id}`, 'data'
        );
    }


    async executeRecordsRequest(method, moduleName, records) {

        return this.executeBulkRequest(method, `/crm/v2/${moduleName}`, 'data', {
            data: { data: records }
        });
    }

    async search(moduleName, params = {}) {

        return this.requestPaginated(
            'GET',
            `/crm/v2/${moduleName}/search`,
            { dataKey: 'data', params }
        );
    }

    async subscribe(url, events) {

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1); // max allowed is 1 day
        const channelId = Math.round(Date.now() + Math.random());

        const data = {
            watch: [
                {
                    events,
                    channel_id: channelId,
                    channel_expiry: moment(expiry).format(),
                    notify_url: url
                }
            ]
        };
        return this.executeBulkRequest('POST', '/crm/v2/actions/watch', 'watch', { data });
    }

    async updateNotificationExpiry(channelId, events) {

        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1); // max allowed is 1 day

        const data = {
            watch: [
                {
                    channel_id: channelId,
                    events,
                    channel_expiry: moment(expiry).format()
                }
            ]
        };
        return this.executeBulkRequest('PATCH', '/crm/v2/actions/watch', 'watch', { data });
    }

    async unsubscribe(ids) {

        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1); // max allowed is 1 day

        return this.executeBulkRequest('DELETE', '/crm/v2/actions/watch', 'watch', {
            params: { channel_ids: ids.join(',') }
        });
    }

    async executeBulkRequest(method, endpoint, arrayDataKey, { data = {}, params = {} } = {}) {

        const response = await this.request(method, endpoint, { data, params });
        if (!response) {
            return null;
        }
        const arrayRecord = response[arrayDataKey];
        const result = Array.isArray(arrayRecord) ? arrayRecord.pop() : null;
        if (result && result.status && result.status === 'error') {
            const error = new Error(result.message);
            error.code = result.code;
            error.data = result;
            throw error;
        }
        return result;
    }

    async requestPaginated(
        method,
        url,
        { dataKey = 'data', countLimit = 500, data = {}, headers = {}, params = {} } = {}
    ) {

        let records = [];
        params.per_page = 200; // Zoho default is 200
        let hasMoreRecords = false;
        let page = 0;
        do {
            page += 1;
            params.page = page;
            const response = await this.request(method, url, { data, headers, params });
            if (response && response[dataKey]) {
                const results = response[dataKey];
                const { info, page_context } = response;
                // Zoho CRM API returns info object. See: https://www.zoho.com/crm/developer/docs/api/v3/get-records.html
                if (info) {
                    hasMoreRecords = info.more_records;
                }
                // Zoho Books API returns page_context object instead of info. See: https://www.zoho.com/books/api/v3/pagination/#overview
                if (page_context) {
                    hasMoreRecords = page_context.has_more_page;
                }
                records = records.concat(results);
            }
        } while (hasMoreRecords && records.length < countLimit);
        return records;
    }

    async request(method, url, { data = {}, headers = {}, params = {} } = {}) {

        const request = {
            method,
            url,
            headers,
            data,
            params
        };

        return this.client(request)
            .then(response => response.data)
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

module.exports = ZohoClient;
