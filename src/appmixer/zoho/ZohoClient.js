/* eslint-disable camelcase */
'use strict';
const moment = require('moment');
const check = require('check-types');
const { apiEndpoint } = require('./endpoints');

class ZohoClient {

    /**
     * @param {*} context Component context
     * @param {string} [regionAuth] Region from global variable in auth.js
     * @param {Object} [options]
     * @param {string} [options.apiVersion] Zoho CRM API version used to build request paths.
     *   Defaults to 'v2' so existing components keep their behaviour. Newer components opt into
     *   a higher version when they need features v2 does not have (e.g. the Appointments module,
     *   or the greater_equal/less_equal/between search comparators, which v2 rejects).
     */
    constructor(context, regionAuth, { apiVersion = 'v2' } = {}) {

        // context.auth.accessToken for component calls
        // context.accessToken for calls from auth.js
        const accessToken = context.auth?.accessToken || context.accessToken;
        const region = context.profileInfo?.region || regionAuth;

        check.assert.string(accessToken, `Missing accessToken: ${accessToken}.`);
        check.assert.string(region, `Missing region: ${region}.`);

        this.apiVersion = apiVersion;
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

    /**
     * Builds a versioned CRM API path, e.g. path('/Cases') -> '/crm/v2/Cases'.
     * @param {string} suffix Path after the version segment, starting with '/'.
     * @returns {string}
     */
    path(suffix) {

        return `/crm/${this.apiVersion}${suffix}`;
    }

    async getFields(moduleName) {

        const { fields } = await this.request(
            'GET',
            this.path('/settings/fields'),
            { params: { module: moduleName } }
        );
        return fields;
    }

    async getRecords(moduleName, { params = {} } = {}) {

        return this.requestPaginated(
            'GET',
            this.path(`/${moduleName}`),
            { dataKey: 'data', params }
        );
    }

    async getRecord(moduleName, id) {

        return this.executeBulkRequest(
            'GET',
            this.path(`/${moduleName}/${id}`), 'data'
        );
    }

    /**
     * Fetches the single most recently touched record of a module without paging through the
     * whole module. Used by the triggers' test() (Flow Test Mode) to build a realistic example.
     * @param {string} moduleName
     * @param {Object} [options]
     * @param {string} [options.sortBy] Field to sort on, newest first.
     * @param {string} [options.fields] Comma separated field API names. Mandatory from API v3 up.
     * @returns {Promise<Object|null>}
     */
    async getLatestRecord(moduleName, { sortBy = 'Modified_Time', fields } = {}) {

        // eslint-disable-next-line camelcase
        const params = { sort_by: sortBy, sort_order: 'desc', per_page: 1 };
        if (fields) {
            params.fields = fields;
        }
        const response = await this.request('GET', this.path(`/${moduleName}`), { params });
        return Array.isArray(response?.data) ? response.data[0] : null;
    }

    async deleteRecord(moduleName, id) {

        return this.executeBulkRequest(
            'DELETE',
            this.path(`/${moduleName}/${id}`), 'data'
        );
    }


    async executeRecordsRequest(method, moduleName, records) {

        return this.executeBulkRequest(method, this.path(`/${moduleName}`), 'data', {
            data: { data: records }
        });
    }

    /**
     * Creates records in a related list of a parent record, e.g. a note attached to a case:
     * POST /crm/v2/Cases/{id}/Notes.
     * @param {string} moduleName Parent module API name.
     * @param {string} recordId Parent record ID.
     * @param {string} relatedListName Related list API name, e.g. 'Notes'.
     * @param {Array<Object>} records
     */
    async createRelatedRecords(moduleName, recordId, relatedListName, records) {

        return this.executeBulkRequest(
            'POST',
            this.path(`/${moduleName}/${recordId}/${relatedListName}`),
            'data',
            { data: { data: records } }
        );
    }

    async search(moduleName, params = {}) {

        return this.requestPaginated(
            'GET',
            this.path(`/${moduleName}/search`),
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
        return this.executeBulkRequest('POST', this.path('/actions/watch'), 'watch', { data });
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
        return this.executeBulkRequest('PATCH', this.path('/actions/watch'), 'watch', { data });
    }

    async unsubscribe(ids) {

        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 1); // max allowed is 1 day

        return this.executeBulkRequest('DELETE', this.path('/actions/watch'), 'watch', {
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
        if (result?.status === 'error') {
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
                if (e.response?.data) {
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
