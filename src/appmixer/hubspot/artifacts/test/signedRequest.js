'use strict';

const { createHmac } = require('crypto');

const CLIENT_SECRET = 'test-client-secret';
const API_URL = 'https://api.appmixer.example.com';
const PATH = '/plugins/appmixer/hubspot/events';

// Builds a request the way HubSpot sends it: raw body + X-HubSpot-Signature-v3 signed with the client secret.
function signedRequest(payload, { secret = CLIENT_SECRET, timestamp = Date.now() } = {}) {

    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', secret)
        .update(`POST${API_URL}${PATH}${rawBody}${timestamp}`)
        .digest('base64');

    return {
        method: 'post',
        path: PATH,
        headers: {
            host: 'internal-engine:2200',
            'x-hubspot-signature-v3': signature,
            'x-hubspot-request-timestamp': String(timestamp)
        },
        payload: Buffer.from(rawBody)
    };
}

// Minimal hapi response toolkit.
const h = {
    response: body => ({ code: statusCode => ({ body, statusCode }) })
};

module.exports = { signedRequest, h, CLIENT_SECRET, API_URL };
