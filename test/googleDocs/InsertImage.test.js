'use strict';

const assert = require('assert');
const path = require('path');
const { createTestDocument } = require('./testHelpers');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const component = require('../../src/appmixer/googleDocs/core/InsertImage/InsertImage');

describe('InsertImage', function() {

    this.timeout(30000);

    let context;
    let testDocumentId;

    before(async function() {
        // Create a test document first
        const createResult = await createTestDocument(
            'Test Document for InsertImage ' + Date.now(),
            process.env.GOOGLE_DOCS_ACCESS_TOKEN
        );
        testDocumentId = createResult.data.documentId;
    });

    after(async function() {
        // Clean up: delete test document (optional)
        // Note: We'll skip cleanup for now to avoid additional complexity
    });

    beforeEach(function() {
        // Skip all tests if the access token is not set
        if (!process.env.GOOGLE_DOCS_ACCESS_TOKEN) {
            console.log('Skipping FindResponses tests - GOOGLE_DOCS_ACCESS_TOKEN not set');
            this.skip();
        }

        context = {
            messages: {
                in: {
                    content: {}
                }
            },
            auth: {
                accessToken: process.env.GOOGLE_DOCS_ACCESS_TOKEN
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

    it('should insert image from URL', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            imageUrl: 'https://via.placeholder.com/300x200.png',
            location: 'end'
        };

        const result = await component.receive(context);

        assert(result.data, 'Should return data');
        assert.strictEqual(result.data.documentId, testDocumentId);
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');

        // Verify types
        assert.strictEqual(typeof result.data.documentId, 'string');
        assert.strictEqual(typeof result.data.success, 'boolean');
    });

    it('should insert image with custom dimensions', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            imageUrl: 'https://via.placeholder.com/400x300.png',
            location: 'beginning',
            width: 200,
            height: 150
        };

        const result = await component.receive(context);

        assert(result.data, 'Should return data');
        assert.strictEqual(result.data.documentId, testDocumentId);
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');

        // Verify types
        assert.strictEqual(typeof result.data.documentId, 'string');
        assert.strictEqual(typeof result.data.success, 'boolean');
    });
});
