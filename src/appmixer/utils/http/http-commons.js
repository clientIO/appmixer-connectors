'use strict';
const contentTypeUtil = require('content-type');
const urlUtil = require('url');
const qs = require('qs');
const axios = require('axios');

/**
 * Converts header property 'content-type' value to more readable json.
 * @param  {string} value
 * @return {{ type: string, parameters: Object }}
 */
function parseContentType(value) {

    try {
        return contentTypeUtil.parse(value);
    } catch (error) {
        return { type: undefined };
    }
}

/**
 * Callback which processes http response in such way, the result should be sent through our messanging system.
 * @param  {Object} response
 * @return {Object}
 */
function processResponse(response) {

    const data = {
        headers: {}
    };

    data.statusCode = response.status;
    data.request = {
        uri: response.config.url,
        method: response.config.method,
        headers: response.config.headers
    };
    data.headers['content-type'] = parseContentType(response.headers['content-type']);
    data.body = response.data;

    return data;
}

/**
 * Builds options for request
 * @param {string} method
 * @param  {Object} options
 * @return {{ options: Object, errors: Array.<Error> }}
 */
function  buildRequestOptions(method, options) {

    let errors = [];
    let url;
    let headers;

    try {
        url = urlUtil.parse(options.url);
    } catch (error) {
        errors.push('Message property \'url\' parse error. ' + error.message);
    }

    try {
        headers = typeof options.headers === 'string' ? JSON.parse(options.headers) : options.headers;
    } catch (error) {
        errors.push('Message property \'headers\' parse error. ' + error.message);
    }

    let body = options.body;

    if (options.bodyBase64Encode && body) {
        try {
            body = Buffer.from(body, 'base64');
        } catch (error) {
            errors.push('Message property \'body\' parse base64 error. ' + error.message);
        }
    } else if (body && typeof body === 'string') {
        try {
            body = JSON.parse(body);
            if (headers) {
                const contentTypeKey = Object.keys(headers).find(h => h.toLowerCase() === 'content-type');
                const contentType = parseContentType(headers[contentTypeKey]);
                if (method.toLowerCase() !== 'get' && contentType.type === 'application/x-www-form-urlencoded') {
                    body = qs.stringify(body);
                }
            }
        } catch {
            // noop
        }
    }

    let encoding = options.responseEncoding;

    let json = {
        method,
        url,
        headers,
        ...(method.toLowerCase() === 'get' ? { params: body } : { data: body }),
        responseEncoding: encoding
    };

    return { options: json, errors };
}

/**
 * Promisified http request.
 * @param  {string} method - POST, DELETE, PUT, GET
 * @param  {{
 *   url: String,
 *   body: String,
 *   bodyBase64Encode: Boolean,
 *   headers: String,
 *   responseEncoding: String
 * }} json options
 * @return {Promise}
 */
module.exports = async function(method, json) {

    let { options, errors } = buildRequestOptions(method, json);
    if (errors.length > 0) {
        // log all errors
        throw new Error(errors.join('. '));
    }

    try {
        const response = await axios.request(options);
        return processResponse(response);
    } catch (error) {
        if (error.response?.data?.message) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            throw new Error(`${error.message}: ${error.response.data.message}`, error.response);
        }
        throw error;
    }
};
