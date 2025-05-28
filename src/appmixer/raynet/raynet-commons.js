'use strict';
const request = require('request-promise');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;
const MAX_PAGING_COUNT = 1000;

const createAggregator = function(fetchFunction) {
    return new PagingAggregator(
        // fetch function
        (args, offset, count) => {

            args.offset = offset;
            args.count = count;

            return fetchFunction(args);
        },
        // aggregation function
        (accumulator, chunk, offset, count) => {
            try {
                chunk = JSON.parse(chunk);
            } catch (err) {
                return reject(err);
            }
            return accumulator.concat(chunk['data']);
        },
        // next offset function
        (accumulator, chunk, offset, count) => {
            try {
                chunk = JSON.parse(chunk);
            } catch (err) {
                return reject(err);
            }
            return accumulator.length < chunk['totalCount'] ?
                offset + chunk['data'].length : -1;
        }
    );
};

/**
 * Get request for raynet.
 * @param {object} authOptions
 * @param {string} endpoint
 * @param {string} method
 * @param {string} instanceName
 * @param {object} [data]
 * @param {string} [id]
 * @returns {*}
 */
const personsAggregator = createAggregator(args => {

    const credentials = `${args.authOptions.login}:${args.authOptions.apiKey}`;
    let authData = new Buffer(credentials).toString('base64');
    let qs = {
        offset: args.offset,
        limit: args.count
    };
    if (args.createdAt) {
        qs['rowInfo.createdAt[GE]'] = args.createdAt;
    }

    return request({
        method: args.method,
        url: args.id ?
            `https://app.raynet.cz/api/v2/${args.endpoint}/${args.id}` :
            `https://app.raynet.cz/api/v2/${args.endpoint}/`,
        headers: {
            'X-Instance-Name': args.instanceName,
            'authorization': `Basic ${authData}`,
            'Content-Type': 'application/json'
        },
        qs: qs
    });
});

module.exports = {

    /**
     * Get persons from raynet.
     * @param {object} args
     * @returns {*}
     */
    getPersons(args) {
        return personsAggregator.fetch(args, 0, MAX_PAGING_COUNT);
    },

    /**
     * Get request for raynet.
     * @param {object} authOptions
     * @param {string} endpoint
     * @param {string} method
     * @param {string} instanceName
     * @param {object} [data]
     * @param {string} [id]
     * @returns {*}
     */
    raynetAPI(authOptions, endpoint, method, instanceName, data, id) {

        const credentials = `${authOptions.login}:${authOptions.apiKey}`;
        let authData = new Buffer(credentials).toString('base64');

        let options = {
            method: method,
            url: id ? `https://app.raynet.cz/api/v2/${endpoint}/${id}` : `https://app.raynet.cz/api/v2/${endpoint}/`,
            headers: {
                'X-Instance-Name': instanceName,
                'authorization': `Basic ${authData}`,
                'Content-Type': 'application/json'
            },
            json: data
        };

        return request(options);
    }
};
