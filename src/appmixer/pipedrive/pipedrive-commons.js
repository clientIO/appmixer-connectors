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
                    version: '1.0',
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

    stringToContactArray,
    PagingAggregator,
    checkListForChanges: appmixerLib.component.checkListForChanges
};
