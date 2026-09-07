'use strict';
const crypto = require('crypto');
const oauthSignature = require('oauth-signature');
const formurlencoded = require('form-urlencoded');

// Sage One requires a unique nonce for every request.
const getNonce = nonceLength => crypto.randomBytes(Math.ceil(nonceLength * 3 / 4))
    .toString('base64').slice(0, nonceLength)
    .replace(/\+/g, '0')
    .replace(/\//g, '0');

function generateSignatureBaseString(method, url, parameters, nonce) {

    const formEncoded = parameters ? formurlencoded(parameters, { sorted: true }).replace(/\+/gm, '%20') : '';
    return method.toUpperCase() + '&' +
        encodeURIComponent(url) + '&' +
        encodeURIComponent(formEncoded) + '&' +
        nonce;
}

function sageOAuthSignature(httpMethod, url, parameters, nonce, signingSecret, accessToken) {

    const signatureBaseString = generateSignatureBaseString(httpMethod, url, parameters, nonce);
    return new oauthSignature
        .HmacSha1Signature(signatureBaseString, signingSecret, accessToken)
        .generate(false);
}

function kvToObj(arr) {
    if (!arr || !Array.isArray(arr)) return {};
    const out = {};
    for (const row of arr) {
        if (!row || typeof row !== 'object') continue;
        const key = row.key;
        if (typeof key !== 'string' || key.length === 0) continue;
        out[key] = row.value;
    }
    return out;
}

module.exports = {
    async receive(context) {

        const { url, method, headers: headersKV, parameters: parametersKV, body } = context.messages.in.content;

        if (!url) {
            throw new context.CancelError('API Endpoint URL is required!');
        }
        if (!method) {
            throw new context.CancelError('HTTP Method is required!');
        }

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;

        const extraHeaders = kvToObj(headersKV);
        const queryParams = kvToObj(parametersKV);

        const baseUrl = 'https://api.sageone.com/accounts/v1';
        const targetUrl = url.startsWith('http://') || url.startsWith('https://')
            ? url
            : `${baseUrl}${url.startsWith('/') ? url : '/' + url}`;

        // Sage One signs the request using the query parameters (sorted) along
        // with a per-request nonce. Build the signature exactly like the other
        // sageone components (see sageone-commons.js).
        const hasParams = Object.keys(queryParams).length > 0;
        const nonce = getNonce(32);
        const signature = sageOAuthSignature(
            method,
            targetUrl,
            hasParams ? queryParams : undefined,
            nonce,
            clientSigningSecret,
            token
        );

        const requestOptions = {
            method,
            url: targetUrl,
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Signature': signature,
                'X-Nonce': nonce,
                'Accept': '*/*',
                'Content-Type': 'application/json',
                'User-Agent': userAgent,
                ...extraHeaders
            }
        };

        let parsedBody;
        if (body) {
            try {
                parsedBody = typeof body === 'object' ? body : JSON.parse(body);
            } catch (e) {
                throw new context.CancelError('Request Body must be valid JSON.');
            }
            requestOptions.data = parsedBody;
        }

        if (hasParams) {
            requestOptions.params = queryParams;
        }

        const response = await context.httpRequest(requestOptions);

        return context.sendJson({
            status: response.status,
            headers: response.headers,
            body: response.data
        }, 'out');
    }
};
