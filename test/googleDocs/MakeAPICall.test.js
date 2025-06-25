'use strict';

const assert = require('assert');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MakeAPICall = require('../../src/appmixer/googleDocs/core/MakeAPICall/MakeAPICall.js');

describe('MakeAPICall', function() {

    let context;

    beforeEach(function() {
        // Skip all tests if the access token is not set
        if (!process.env.GOOGLE_DOCS_ACCESS_TOKEN) {
            console.log('Skipping FindResponses tests - GOOGLE_DOCS_ACCESS_TOKEN not set');
            this.skip();
        }
        context = {
            auth: {
                accessToken: process.env.GOOGLE_DOCS_ACCESS_TOKEN
            },
            messages: {
                in: {
                    content: {}
                }
            },
            httpRequest: async function(options) {
                const https = require('https');
                const http = require('http');
                const URL = require('url').URL;

                return new Promise((resolve, reject) => {
                    const url = new URL(options.url);
                    const client = url.protocol === 'https:' ? https : http;

                    const requestOptions = {
                        hostname: url.hostname,
                        port: url.port,
                        path: url.pathname + url.search,
                        method: options.method,
                        headers: options.headers
                    };

                    const req = client.request(requestOptions, (res) => {
                        let data = '';
                        res.on('data', (chunk) => {
                            data += chunk;
                        });
                        res.on('end', () => {
                            try {
                                const jsonData = JSON.parse(data);
                                resolve({
                                    data: jsonData,
                                    status: res.statusCode,
                                    headers: res.headers
                                });
                            } catch (e) {
                                resolve({
                                    data: data,
                                    status: res.statusCode,
                                    headers: res.headers
                                });
                            }
                        });
                    });

                    req.on('error', reject);

                    if (options.data) {
                        req.write(JSON.stringify(options.data));
                    }
                    req.end();
                });
            },
            sendJson: function(data, port) {
                return { data, port };
            }
        };
    });

    it('should make a GET API call with relative URL', async function() {
        // First create a document to test with
        const createResult = await context.httpRequest({
            method: 'POST',
            url: 'https://docs.googleapis.com/v1/documents',
            headers: {
                'Authorization': `Bearer ${process.env.GOOGLE_DOCS_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                title: 'Test Document for MakeAPICall ' + Date.now()
            }
        });

        const documentId = createResult.data.documentId;

        context.messages.in.content = {
            url: `documents/${documentId}`,
            method: 'GET'
        };

        const result = await MakeAPICall.receive(context);

        assert(result.data.data, 'Response data should be returned');
        assert.strictEqual(typeof result.data.status, 'number');
        assert(result.data.headers, 'Response headers should be returned');
        assert.strictEqual(result.port, 'out');
    });

    it('should make a GET API call with absolute URL', async function() {
        // First create a document to test with
        const createResult = await context.httpRequest({
            method: 'POST',
            url: 'https://docs.googleapis.com/v1/documents',
            headers: {
                'Authorization': `Bearer ${process.env.GOOGLE_DOCS_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                title: 'Test Document for MakeAPICall Absolute ' + Date.now()
            }
        });

        const documentId = createResult.data.documentId;

        context.messages.in.content = {
            url: `https://docs.googleapis.com/v1/documents/${documentId}`,
            method: 'GET'
        };

        const result = await MakeAPICall.receive(context);

        assert(result.data.data, 'Response data should be returned');
        assert.strictEqual(typeof result.data.status, 'number');
        assert(result.data.headers, 'Response headers should be returned');
        assert.strictEqual(result.port, 'out');
    });

    it('should make a POST API call to create document', async function() {
        context.messages.in.content = {
            url: 'documents',
            method: 'POST',
            data: {
                title: 'Test Document via MakeAPICall ' + Date.now()
            }
        };

        const result = await MakeAPICall.receive(context);

        assert(result.data.data, 'Response data should be returned');
        assert(result.data.data.documentId, 'Document ID should be in response');
        assert.strictEqual(typeof result.data.status, 'number');
        assert(result.data.headers, 'Response headers should be returned');
        assert.strictEqual(result.port, 'out');
    });
});
