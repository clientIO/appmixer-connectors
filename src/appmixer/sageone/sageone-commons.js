'use strict';
const request = require('request-promise');
const crypto = require('crypto');
const oauthSignature = require('oauth-signature');
const formurlencoded = require('form-urlencoded');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;

/**
 * Get nonce for requests.
 * Every request in sageone must have unique nonce
 * @param {number} nonceLength
 * @returns {*}
 */
const getNonce = nonceLength => crypto.randomBytes(Math.ceil(nonceLength * 3 / 4))
    .toString('base64').slice(0, nonceLength)
    .replace(/\+/g, '0')
    .replace(/\//g, '0');

/**
 * Replacement for oauthSignature.SignatureBaseString
 * @param {string} method
 * @param {string} url
 * @param {Object} parameters
 * @param {string} nonce
 * @return {string}
 */
function generateSignatureBaseString(method, url, parameters, nonce) {

    const formEncoded = parameters ? formurlencoded(parameters, { sorted: true }).replace(/\+/gm, '%20') : '';
    return method.toUpperCase() + '&' +
        encodeURIComponent(url) + '&' +
        encodeURIComponent(formEncoded) + '&' +
        nonce;
}

/**
 * Set sageone OAuth signature.
 * @param {String} httpMethod
 * @param {String} url
 * @param {Object} parameters
 * @param {String} nonce
 * @param {String} signingSecret
 * @param {String} accessToken
 * @param {Object} options
 * @returns {*}
 */
const SageOAuthSignature = (httpMethod, url, parameters, nonce, signingSecret, accessToken, options) => {

    let signatureBaseString = generateSignatureBaseString(httpMethod, url, parameters, nonce);

    let encodeSignature = true;
    if (options) {
        encodeSignature = options.encodeSignature;
    }
    return new oauthSignature
        .HmacSha1Signature(signatureBaseString, signingSecret, accessToken)
        .generate(encodeSignature);
};

const createAggregator = function(fetchFunction) {
    return new PagingAggregator(
        // fetch function
        (args, offset, count) => {

            args.parameters.$startIndex = offset;
            args.parameters.$itemsPerPage = count;

            return fetchFunction(args);
        },
        // aggregation function
        (accumulator, chunk, offset, count) => {
            try {
                chunk = JSON.parse(chunk);
            } catch (err) {
                return reject(err);
            }
            return accumulator.concat(chunk['$resources']);
        },
        // next offset function
        (accumulator, chunk, offset, count) => {
            try {
                chunk = JSON.parse(chunk);
            } catch (err) {
                return reject(err);
            }
            return accumulator.length < chunk['$totalResults'] ?
                offset + chunk['$resources'].length : -1;
        }
    );
};

/**
 * Get request for sageone.
 * @param {object} args
 * @returns {*}
 */
const itemsAggregator = createAggregator(args => {

    const nonce = getNonce(32);
    const OAuthSignature = SageOAuthSignature(
        'GET',
        args.url,
        args.parameters,
        nonce,
        args.clientSigningSecret,
        args.token,
        { encodeSignature: false });

    const qs = args.parameters && typeof args.parameters == 'object' ? '?' + formurlencoded(args.parameters, { sorted: true }) : '';

    return request.get(args.url + qs, {
        headers: {
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${args.token}`,
            'X-Nonce': nonce,
            'X-Signature': OAuthSignature,
            'User-Agent': args.userAgent
        }
    });
});

module.exports = {

    getItems(args) {
        // $startIndex and $itemsPerPage are passed by parameters because of OAuthSignature
        return itemsAggregator.fetch(args, args.parameters.$startIndex, args.parameters.$itemsPerPage);
    },

    /**
     * sageoneAPI for sageone
     * @param {String} method
     * @param {String} token
     * @param {String} url
     * @param {String} userAgent
     * @param {String} clientSigningSecret
     * @param {Object} [parameters]
     * @returns {*}
     */
    sageoneAPI(method, token, url, userAgent, clientSigningSecret, parameters) {

        const nonce = getNonce(32);
        const OAuthSignature = SageOAuthSignature(
            method,
            url,
            parameters,
            nonce,
            clientSigningSecret,
            token,
            { encodeSignature: false });

        const qs = parameters && typeof parameters == 'object' ?
            '?' + formurlencoded(parameters, { sorted: true }) : '';

        let req = {
            method,
            url: url + qs,
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Signature': OAuthSignature,
                'X-Nonce': nonce,
                'Accept': '*/*',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': userAgent
            },
            body: formurlencoded(parameters || {})
        };

        return request(req);
    }
};
