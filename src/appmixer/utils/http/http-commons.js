'use strict';
const contentTypeUtil = require('content-type');
const urlUtil = require('url');
const qs = require('qs');
const axios = require('axios');
const https = require('https');

/**
 * Loads undici lazily. It is only needed for requests with SSL/TLS options and the version
 * range we can ship is bound to the Node.js version of the engine (undici 7 needs Node 20+,
 * undici 6 needs Node 18.17+). Requiring it at module load time would make the whole connector
 * fail to install on an unsupported Node.js, e.g. `ReferenceError: File is not defined`
 * on Node 18 with undici 7 (support ticket #9714).
 * @return {{ request: Function, Agent: Function }}
 */
function loadUndici() {

    try {
        return require('undici');
    } catch (error) {
        throw new Error(
            `SSL/TLS options require the 'undici' package, which failed to load on Node.js ${process.version}. ` +
            error.message
        );
    }
}

/**
 * Validates PEM certificate format.
 * @param {string} cert - Certificate string to validate
 * @param {string} certType - Type of certificate ('CA Certificate', 'Client Certificate', 'Client Key')
 * @throws {Error} If certificate format is invalid
 */
function validatePemCertificate(cert, certType) {

    if (!cert || typeof cert !== 'string') {
        throw new Error(`${certType} must be a non-empty string.`);
    }

    const trimmedCert = cert.trim();

    // Check for PEM format markers
    const pemPatterns = [
        { begin: '-----BEGIN CERTIFICATE-----', end: '-----END CERTIFICATE-----' },
        { begin: '-----BEGIN RSA PRIVATE KEY-----', end: '-----END RSA PRIVATE KEY-----' },
        { begin: '-----BEGIN PRIVATE KEY-----', end: '-----END PRIVATE KEY-----' },
        { begin: '-----BEGIN EC PRIVATE KEY-----', end: '-----END EC PRIVATE KEY-----' }
    ];

    const isValidPem = pemPatterns.some(pattern => {
        return trimmedCert.includes(pattern.begin) && trimmedCert.includes(pattern.end);
    });

    if (!isValidPem) {
        throw new Error(
            `${certType} is not in valid PEM format. ` +
            'Expected certificate to start with "-----BEGIN CERTIFICATE-----" or ' +
            '"-----BEGIN PRIVATE KEY-----" and end with corresponding END marker.'
        );
    }
}

/**
 * Builds HTTPS agent with custom certificates.
 * @param {Object} context - Component context for file operations
 * @param {Object} certOptions - Certificate options
 * @param {string} [certOptions.caCertificateFileId] - CA certificate file ID
 * @param {string} [certOptions.clientCertificateFileId] - Client certificate file ID
 * @param {string} [certOptions.clientKeyFileId] - Client private key file ID
 * @param {boolean} [certOptions.ignoreSsl] - Whether to ignore SSL certificate validation
 * @return {Promise<https.Agent|null>} HTTPS agent or null if no options provided
 */
async function buildHttpsAgent(context, certOptions) {

    const { caCertificateFileId, clientCertificateFileId, clientKeyFileId, ignoreSsl } = certOptions || {};

    // If no certificates or SSL options provided, return null
    if (!caCertificateFileId && !clientCertificateFileId && !clientKeyFileId && !ignoreSsl) {
        return null;
    }

    // Build agent options
    const agentOptions = {};

    // Handle ignore SSL
    if (ignoreSsl) {
        agentOptions.rejectUnauthorized = false;
    }

    // Read and validate CA certificate if provided
    // Skip CA certificate if ignoreSsl is true (contradictory options)
    if (caCertificateFileId && !ignoreSsl) {
        const caBuffer = await context.getFileReadStream(caCertificateFileId);
        const caChunks = [];
        for await (const chunk of caBuffer) {
            caChunks.push(chunk);
        }
        const caCertificate = Buffer.concat(caChunks).toString('utf8');
        validatePemCertificate(caCertificate, 'CA Certificate');
        agentOptions.ca = caCertificate;
    }

    // Read and validate client certificate if provided
    if (clientCertificateFileId) {
        const certBuffer = await context.getFileReadStream(clientCertificateFileId);
        const certChunks = [];
        for await (const chunk of certBuffer) {
            certChunks.push(chunk);
        }
        const clientCertificate = Buffer.concat(certChunks).toString('utf8');
        validatePemCertificate(clientCertificate, 'Client Certificate');
        agentOptions.cert = clientCertificate;
    }

    // Read and validate client key if provided
    if (clientKeyFileId) {
        const keyBuffer = await context.getFileReadStream(clientKeyFileId);
        const keyChunks = [];
        for await (const chunk of keyBuffer) {
            keyChunks.push(chunk);
        }
        const clientKey = Buffer.concat(keyChunks).toString('utf8');
        validatePemCertificate(clientKey, 'Client Key');
        agentOptions.key = clientKey;
    }

    return new https.Agent(agentOptions);
}

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
        headers: response.headers
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
 * @param {Object} context - Component context for file operations
 * @param {string} method
 * @param  {Object} options
 * @return {Promise<{ options: Object, errors: Array.<Error> }>}
 */
async function buildRequestOptions(context, method, options) {

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

    let encoding = options.responseEncoding === 'noEncoding' ? null : options.responseEncoding;

    let json = {
        method,
        url,
        headers,
        ...(method.toLowerCase() === 'get' ? { params: body } : { data: body })
    };

    if (encoding !== null) {
        json.responseEncoding = encoding;
    }

    // Add HTTPS agent if certificates or SSL options are provided
    try {
        const httpsAgent = await buildHttpsAgent(context, {
            caCertificateFileId: options.caCertificateFileId,
            clientCertificateFileId: options.clientCertificateFileId,
            clientKeyFileId: options.clientKeyFileId,
            ignoreSsl: options.ignoreSsl
        });

        if (httpsAgent) {
            json.httpsAgent = httpsAgent;
        }
    } catch (error) {
        errors.push('Certificate configuration error. ' + error.message);
    }

    return { options: json, errors };
}

/**
 * Builds HTTPS agent from certificate file IDs (simplified version for direct use in components).
 * @param {Object} context - Component context for file operations
 * @param {string} [caCertificateFileId] - CA certificate file ID
 * @param {string} [clientCertificateFileId] - Client certificate file ID
 * @param {string} [clientKeyFileId] - Client private key file ID
 * @param {boolean} [ignoreSsl] - Whether to ignore SSL certificate validation
 * @return {Promise<https.Agent|null>} HTTPS agent or null if no options provided
 */
async function buildHttpsAgentFromFiles(
    context,
    caCertificateFileId,
    clientCertificateFileId,
    clientKeyFileId,
    ignoreSsl
) {

    // If no certificates or SSL options provided, return null
    if (!caCertificateFileId && !clientCertificateFileId && !clientKeyFileId && !ignoreSsl) {
        return null;
    }

    const agentOptions = {};

    if (ignoreSsl) {
        agentOptions.rejectUnauthorized = false;
    }

    // Read and validate CA certificate if provided
    if (caCertificateFileId) {
        const caBuffer = await context.getFileReadStream(caCertificateFileId);
        const caChunks = [];
        for await (const chunk of caBuffer) {
            caChunks.push(chunk);
        }
        const caCert = Buffer.concat(caChunks).toString('utf8');
        validatePemCertificate(caCert, 'CA Certificate');
        agentOptions.ca = caCert;
    }

    // Read and validate client certificate if provided
    if (clientCertificateFileId) {
        const certBuffer = await context.getFileReadStream(clientCertificateFileId);
        const certChunks = [];
        for await (const chunk of certBuffer) {
            certChunks.push(chunk);
        }
        const clientCert = Buffer.concat(certChunks).toString('utf8');
        validatePemCertificate(clientCert, 'Client Certificate');
        agentOptions.cert = clientCert;
    }

    // Read and validate client key if provided
    if (clientKeyFileId) {
        const keyBuffer = await context.getFileReadStream(clientKeyFileId);
        const keyChunks = [];
        for await (const chunk of keyBuffer) {
            keyChunks.push(chunk);
        }
        const clientKey = Buffer.concat(keyChunks).toString('utf8');
        validatePemCertificate(clientKey, 'Client Key');
        agentOptions.key = clientKey;
    }

    return new https.Agent(agentOptions);
}

/**
 * Helper to determine if SSL options are provided
 * @param {Object} content - Message content
 * @return {boolean}
 */
function hasSslOptions(content) {
    if (!content) {
        return false;
    }
    const { caCertificateFileId, clientCertificateFileId, clientKeyFileId, ignoreSsl } = content;
    return !!(caCertificateFileId || clientCertificateFileId || clientKeyFileId || ignoreSsl);
}

/**
 * Builds undici agent with SSL/TLS options
 * @param {Object} context - Component context for file operations
 * @param {Object} certOptions - Certificate options
 * @param {string} [certOptions.caCertificateFileId] - CA certificate file ID
 * @param {string} [certOptions.clientCertificateFileId] - Client certificate file ID
 * @param {string} [certOptions.clientKeyFileId] - Client private key file ID
 * @param {boolean} [certOptions.ignoreSsl] - Whether to ignore SSL certificate validation
 * @return {Promise<Agent>} Undici Agent with TLS options
 */
async function buildUndiciAgent(context, certOptions) {

    const { caCertificateFileId, clientCertificateFileId, clientKeyFileId, ignoreSsl } = certOptions || {};

    const agentOptions = {
        connect: {}
    };

    if (ignoreSsl) {
        agentOptions.connect.rejectUnauthorized = false;
    }

    // Read and validate CA certificate if provided
    if (caCertificateFileId) {
        const caBuffer = await context.getFileReadStream(caCertificateFileId);
        const caChunks = [];
        for await (const chunk of caBuffer) {
            caChunks.push(chunk);
        }
        const caCert = Buffer.concat(caChunks).toString('utf8');
        validatePemCertificate(caCert, 'CA Certificate');
        agentOptions.connect.ca = caCert;
    }

    // Read and validate client certificate if provided
    if (clientCertificateFileId) {
        const certBuffer = await context.getFileReadStream(clientCertificateFileId);
        const certChunks = [];
        for await (const chunk of certBuffer) {
            certChunks.push(chunk);
        }
        const clientCert = Buffer.concat(certChunks).toString('utf8');
        validatePemCertificate(clientCert, 'Client Certificate');
        agentOptions.connect.cert = clientCert;
    }

    // Read and validate client key if provided
    if (clientKeyFileId) {
        const keyBuffer = await context.getFileReadStream(clientKeyFileId);
        const keyChunks = [];
        for await (const chunk of keyBuffer) {
            keyChunks.push(chunk);
        }
        const clientKey = Buffer.concat(keyChunks).toString('utf8');
        validatePemCertificate(clientKey, 'Client Key');
        agentOptions.connect.key = clientKey;
    }

    const { Agent } = loadUndici();
    return new Agent(agentOptions);
}

/**
 * Send HTTP request using undici with SSL options
 * @param {Object} context - Component context for file operations
 * @param {string} method - HTTP method
 * @param {Object} options - Request options
 * @return {Promise<Object>} Response object
 */
async function sendWithUndici(context, method, options) {

    const { url, headers: headersProp, body: bodyProp } = options;
    const { caCertificateFileId, clientCertificateFileId, clientKeyFileId, ignoreSsl } = options;

    // Parse headers
    let headers;
    try {
        headers = typeof headersProp === 'string' ? JSON.parse(headersProp) : headersProp;
    } catch (error) {
        throw new Error('Message property "headers" parse error. ' + error.message);
    }

    // Parse body
    let body = bodyProp;
    if (body && typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {
            // Keep as string if not JSON
        }
    }

    // Convert body to string if it's an object
    if (body && typeof body === 'object') {
        body = JSON.stringify(body);
    }

    // Build undici agent with SSL options
    const agent = await buildUndiciAgent(context, {
        caCertificateFileId,
        clientCertificateFileId,
        clientKeyFileId,
        ignoreSsl
    });

    const { request: undiciRequest } = loadUndici();

    try {
        const { statusCode, body: responseBody, headers: responseHeaders } = await undiciRequest(url, {
            method: method.toUpperCase(),
            headers,
            body,
            dispatcher: agent
        });

        const responseData = await responseBody.json();

        return {
            statusCode,
            headers: responseHeaders,
            body: responseData,
            status: statusCode,
            data: responseData,
            config: {
                url,
                method: method.toUpperCase(),
                headers
            }
        };
    } catch (error) {
        throw new Error(`Failed to send request with undici: ${error.message}`);
    }
}

/**
 * Promisified http request.
 * @param  {Object} context - Component context for file operations
 * @param  {string} method - POST, DELETE, PUT, GET
 * @param  {{
 *   url: String,
 *   body: String,
 *   bodyBase64Encode: Boolean,
 *   headers: String,
 *   responseEncoding: String,
 *   caCertificateFileId: String,
 *   clientCertificateFileId: String,
 *   clientKeyFileId: String,
 *   ignoreSsl: Boolean
 * }} json options
 * @return {Promise}
 */
module.exports = async function(context, method, json) {

    // Use undici if SSL options are provided, otherwise use axios
    if (hasSslOptions(json)) {
        return await sendWithUndici(context, method, json);
    }

    let { options, errors } = await buildRequestOptions(context, method, json);
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

module.exports.buildHttpsAgentFromFiles = buildHttpsAgentFromFiles;
module.exports.buildHttpsAgent = buildHttpsAgent;
module.exports.buildUndiciAgent = buildUndiciAgent;
module.exports.sendWithUndici = sendWithUndici;
module.exports.loadUndici = loadUndici;
module.exports.hasSslOptions = hasSslOptions;
