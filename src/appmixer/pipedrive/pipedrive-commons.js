'use strict';
const Promise = require('bluebird');
const Pipedrive = require('pipedrive');
const appmixerLib = require('appmixer-lib').util;
const PagingAggregator = appmixerLib.PagingAggregator;

/**
 * Creates array from comma separated string
 * @param  {string} contacts - comma separated contacts
 * @return {Array.<Object>}
 */
function stringToContactArray(contacts) {
    let getPrimary = () => { getPrimary = () => false; return true; };
    return typeof contacts == 'string' ?
        contacts.split(',').map(contact => ({ value: contact, primary: getPrimary() })) :
        undefined;
}

/**
 * Custom promisifier to get right error handling
 * because pipedrive driver doesn't handle them properly (in a way, we want)
 * @param  {function} originalMethod
 * @return {function}
 */
function promisifier(originalMethod) {
    // return a function
    return function promisified(...args) {
        // which returns a promise
        return new Promise((resolve, reject) => {
            args.push((error, data, reserved, res) => {
                if (error) {
                    return reject(error);
                }

                let responseData;
                try {
                    responseData = JSON.parse(res.response.rawEncoded.toString());
                } catch (parseError) {
                    return reject(parseError);
                }

                if (responseData.success === false) {
                    const info = responseData['error_info'] ? ' - ' + responseData['error_info'] : '';
                    responseData.formattedError = responseData['error'] + info;
                }

                // the data from Pipedrive driver are already wrapped to objects, so use them
                responseData.data = data;

                return resolve(responseData);
            });
            originalMethod(...args);
        });
    };
}

module.exports = {
    /**
     * Get new Pipedrive API wrapper
     * @param {string} token
     * @returns {*}
     */
    getAPI(token) {
        return new Pipedrive.Client(token, { strictMode: true });
    },

    /**
     * Get driver for specified collection
     * @param  {string} token
     * @param  {string} collectionName
     * @return {Object}
     */
    getPromisifiedClient(token, collectionName) {
        const client = this.getAPI(token);
        return Promise.promisifyAll(client[collectionName], { promisifier });
    },

    async registerWebhook(context, eventAction, eventObject) {
        try {
            const options = {
                method: 'POST',
                url: `https://api.pipedrive.com/v1/webhooks?api_token=${context.auth.apiKey}`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: {
                    event_action: eventAction,
                    event_object: eventObject,
                    version: '2.0',
                    subscription_url: context.getWebhookUrl()
                }
            };

            const response = await context.httpRequest(options);
            if (response.status !== 201) {
                throw new Error('Failed to register webhook');
            }

            await context.saveState({ webhookId: response.data.data.id });
        } catch (error) {
            throw new Error(`Failed to register webhook: ${error.message}`);
        }
    },

    async unregisterWebhook(context) {
        const webhookId = context.state?.webhookId;

        if (webhookId) {
            try {
                const options = {
                    method: 'DELETE',
                    url: `https://api.pipedrive.com/v1/webhooks/${webhookId}?api_token=${context.auth.apiKey}`
                };
                await context.httpRequest(options);
            } catch (error) {
                throw new Error(`Failed to unregister webhook: ${error.message}`);
            }
        }
    },

    /**
     * Shared request path used by both tick() and test() of the polling triggers.
     * Lists all records of the given collection and returns the array of driver model
     * objects (each exposing .get()/.toObject()), throwing a CancelError on API failure.
     * @param {Object} context
     * @param {string} collectionName - Pipedrive driver collection (e.g. 'Deals', 'Notes')
     * @param {Object} [params] - query params passed to getAllAsync
     * @return {Promise<Array>} array of driver model objects
     */
    async listRecords(context, collectionName, params = {}) {
        const client = this.getPromisifiedClient(context.auth.apiKey, collectionName);
        const response = await client.getAllAsync(params);
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }
        return Array.isArray(response.data) ? response.data : [];
    },

    /**
     * Fetch a single representative record for Flow Test Mode. Reuses the same
     * listRecords() request path as tick() and returns the first record in the
     * exact shape tick() emits (item.toObject()), or null when none exist.
     * @param {Object} context
     * @param {string} collectionName
     * @param {Object} [params]
     * @return {Promise<Object|null>}
     */
    async fetchLatestExample(context, collectionName, params = {}) {
        const records = await this.listRecords(context, collectionName, params);
        const first = records[0];
        return first ? first.toObject() : null;
    },

    /**
     * Read-only fetch of the newest person for the webhook triggers' test() (Flow
     * Test Mode). The person webhook triggers (PersonAdded/PersonUpdated/PersonDeleted)
     * register a v2 webhook whose receive() forwards the bare person object
     * (data.data for create/change, data.previous for delete). To produce that exact
     * shape without a real event, this lists persons newest-first via the REST API and
     * returns the first one. Returns null when no person exists.
     * @param {Object} context
     * @param {string} [sortField] - person timestamp to sort by, e.g. 'add_time' or 'update_time'
     * @return {Promise<Object|null>}
     */
    async fetchLatestPerson(context, sortField = 'add_time') {
        const response = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pipedrive.com/v1/persons',
            params: {
                api_token: context.auth.apiKey,
                sort: `${sortField} DESC`,
                limit: 1
            }
        });
        const persons = response.data?.data;
        return Array.isArray(persons) && persons.length ? persons[0] : null;
    },

    stringToContactArray,
    PagingAggregator,
    checkListForChanges: appmixerLib.component.checkListForChanges
};
