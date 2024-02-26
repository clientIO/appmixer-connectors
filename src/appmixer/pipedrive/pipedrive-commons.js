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

    stringToContactArray,
    PagingAggregator,
    checkListForChanges: appmixerLib.component.checkListForChanges
};
