'use strict';

const assert = require('assert');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const FindDocuments = require('../../src/appmixer/googleDocs/core/FindDocuments/FindDocuments.js');

describe('FindDocuments', function() {

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
            properties: {},
            CancelError: class CancelError extends Error {},
            config: {},
            componentId: 'test-component',
            flowDescriptor: {
                'test-component': {
                    label: 'TestComponent'
                }
            },
            log: async function(message) {
                console.log('LOG:', message);
            },
            saveFileStream: async function(fileName, buffer) {
                return { fileId: 'test-file-id' };
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
                                resolve({ data: jsonData, status: res.statusCode });
                            } catch (e) {
                                resolve({ data: data, status: res.statusCode });
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
            sendJson: async function(data, port) {
                return { data, port };
            }
        };
    });

    it('should find documents with query', async function() {
        context.messages.in.content = {
            query: 'Test',
            outputType: 'array'
        };

        let capturedResult = null;
        context.sendJson = async function(data, port) {
            capturedResult = { data, port };
            return capturedResult;
        };

        await FindDocuments.receive(context);
        console.log('Captured result:', capturedResult);

        assert(capturedResult, 'Result should be captured');
        assert(capturedResult.data, 'Result should have data property');
        assert(capturedResult.data.result && Array.isArray(capturedResult.data.result), 'Result should contain an array');
        assert.strictEqual(capturedResult.port, 'out');
    });

    it('should find documents without query (all documents)', async function() {
        context.messages.in.content = {
            outputType: 'array'
        };

        let capturedResult = null;
        context.sendJson = async function(data, port) {
            capturedResult = { data, port };
            return capturedResult;
        };

        await FindDocuments.receive(context);

        assert(capturedResult, 'Result should be captured');
        assert(capturedResult.data, 'Result should have data property');
        assert(capturedResult.data.result && Array.isArray(capturedResult.data.result), 'Result should contain an array');
        assert.strictEqual(capturedResult.port, 'out');
    });

    it('should return first item only when outputType is first', async function() {
        context.messages.in.content = {
            query: 'Test',
            outputType: 'first'
        };

        let capturedResult = null;
        context.sendJson = async function(data, port) {
            capturedResult = { data, port };
            return capturedResult;
        };

        await FindDocuments.receive(context);

        if (capturedResult && capturedResult.data) {
            assert.strictEqual(typeof capturedResult.data, 'object');
            assert(!Array.isArray(capturedResult.data), 'Result should not be an array when outputType is first');
        }
        assert.strictEqual(capturedResult.port, 'out');
    });
});
