'use strict';

const assert = require('assert');
const path = require('path');
const { createTestDocument, batchUpdateDocument } = require('./testHelpers');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MakeLinksClickable = require('../../src/appmixer/googleDocs/core/MakeLinksClickable/MakeLinksClickable.js');

describe('MakeLinksClickable', function() {

    let context;
    let testDocumentId;

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

    before(async function() {
        // Create a test document with URLs
        const createResult = await createTestDocument(
            'Test Document for MakeLinksClickable ' + Date.now(),
            process.env.GOOGLE_DOCS_ACCESS_TOKEN
        );
        testDocumentId = createResult.data.documentId;

        // Add some text with URLs
        await batchUpdateDocument(testDocumentId, [{
            insertText: {
                location: { index: 1 },
                text: 'Visit https://www.google.com for search. Also check out https://docs.google.com for more information.'
            }
        }], process.env.GOOGLE_DOCS_ACCESS_TOKEN);
    });

    it('should make links clickable in document', async function() {
        context.messages.in.content = {
            documentId: testDocumentId
        };

        const result = await MakeLinksClickable.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(typeof result.data.linksCount, 'number');
        assert.strictEqual(result.data.success, true);
        assert(result.data.linksCount >= 0, 'Links count should be non-negative');
        assert.strictEqual(result.port, 'out');
    });

    it('should handle document with no links', async function() {
        // Create a document without URLs
        const createResult = await context.httpRequest({
            method: 'POST',
            url: 'https://docs.googleapis.com/v1/documents',
            headers: {
                'Authorization': `Bearer ${process.env.GOOGLE_DOCS_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                title: 'Test Document No Links ' + Date.now()
            }
        });

        // Add text without URLs
        await context.httpRequest({
            method: 'POST',
            url: `https://docs.googleapis.com/v1/documents/${createResult.data.documentId}:batchUpdate`,
            headers: {
                'Authorization': `Bearer ${process.env.GOOGLE_DOCS_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                requests: [{
                    insertText: {
                        location: { index: 1 },
                        text: 'This document has no links at all.'
                    }
                }]
            }
        });

        context.messages.in.content = {
            documentId: createResult.data.documentId
        };

        const result = await MakeLinksClickable.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(result.data.linksCount, 0);
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');
    });
});
