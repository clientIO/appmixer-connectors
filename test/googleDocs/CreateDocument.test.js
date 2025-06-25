'use strict';

const assert = require('assert');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CreateDocument = require('../../src/appmixer/googleDocs/core/CreateDocument/CreateDocument.js');

describe('CreateDocument', function() {

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
            sendJson: function(data, port) {
                return { data, port };
            }
        };
    });

    it('should create a document with title only', async function() {
        context.messages.in.content = {
            title: 'Test Document ' + Date.now()
        };

        const result = await CreateDocument.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(typeof result.data.documentId, 'string');
        assert(result.data.title, 'Document title should be returned');
        assert.strictEqual(result.port, 'out');
    });

    it('should create a document with title and content', async function() {
        context.messages.in.content = {
            title: 'Test Document with Content ' + Date.now(),
            content: 'This is test content for the document.'
        };

        const result = await CreateDocument.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(typeof result.data.documentId, 'string');
        assert(result.data.title, 'Document title should be returned');
        assert.strictEqual(result.port, 'out');
    });

    it('should create a document with default title when none provided', async function() {
        context.messages.in.content = {};

        const result = await CreateDocument.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(typeof result.data.documentId, 'string');
        assert(result.data.title, 'Document title should be returned');
        assert.strictEqual(result.port, 'out');
    });
});
