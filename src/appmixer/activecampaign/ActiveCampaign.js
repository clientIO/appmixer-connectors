'use strict';
const axios = require('axios');

class ActiveCampaign {

    constructor(url, apiKey) {

        this.url = `${url}/api/3`;
        this.apiKey = apiKey;
    }

    static get MAX_RECORDS_PER_PAGE() {

        return 100;
    }

    async call(method, path, data = {}, opts = {}) {

        const payload = {
            method,
            headers: {
                'Api-Token': this.apiKey
            }
        };

        if (method.toLowerCase() === 'get') {
            payload.params = data;
        } else {
            payload.data = data;
        }

        try {
            return await axios(`${this.url}/${path}`, payload);
        } catch (err) {
            const { response } = err;
            if (response.status === 422) {
                if (response.data?.errors) {
                    const errors = response.data.errors.map(err => err.title).join(', ');
                    const msg = `Your request have the following errors:\n${errors}`;
                    throw new Error(msg);
                }
            }
            throw err;
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

    getPageLimit(limit) {

        return limit < ActiveCampaign.MAX_RECORDS_PER_PAGE ? limit : ActiveCampaign.MAX_RECORDS_PER_PAGE;
    }

    getNumberOfPages(limit) {

        return Math.ceil(limit/this.getPageLimit(limit));
    }

    paginatedCall(method, path, data = {}, limit = 100, assembler) {

        const pageLimit = this.getPageLimit(limit);
        const nPages = this.getNumberOfPages(limit);

        const callFn = (iterations) => {

            const offset = pageLimit * iterations;
            return this.call(method, path, {
                ...data,
                offset
            });
        }

        return this.accumulativeCall(nPages, callFn, assembler);
    }

    getContacts(params, limit = 100) {

        const assembler = (data) => {

            return data.reduce((acc, response) => {
                const { contacts = [] } = response.data || {};
                return acc.concat(contacts);
            }, []);
        }

        return this.paginatedCall('get', 'contacts', params, limit, assembler);
    }

    getDeals(params, limit = 100) {

        const assembler = (data) => {

            return data.reduce((acc, response) => {
                const { deals = [] } = response.data || {};
                return acc.concat(deals);
            }, []);
        }

        return this.paginatedCall('get', 'deals', params, limit, assembler);
    }

    getTasks(params, limit) {

        const assembler = (data) => {

            return data.reduce((acc, response) => {
                const { dealTasks = [] } = response.data || {};
                return acc.concat(dealTasks);
            }, []);
        }

        return this.paginatedCall('get', 'dealTasks', params, limit, assembler);
    }

    registerWebhook(name, url, events) {

        return this.call('post', 'webhooks', {
            webhook: {
                name,
                url,
                events,
                sources: ['public', 'admin', 'api', 'system']
            }
        });
    }

    unregisterWebhook(id) {

        return this.call('delete', `webhooks/${id}`);
    }
}

module.exports = ActiveCampaign;
