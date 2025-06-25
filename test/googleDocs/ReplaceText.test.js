'use strict';

const assert = require('assert');
const path = require('path');
const { createTestDocument, batchUpdateDocument } = require('./testHelpers');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ReplaceText = require('../../src/appmixer/googleDocs/core/ReplaceText/ReplaceText.js');

describe('ReplaceText', function() {

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
        // Create a test document with initial content
        const createResult = await createTestDocument(
            'Test Document for ReplaceText ' + Date.now(),
            process.env.GOOGLE_DOCS_ACCESS_TOKEN
        );
        testDocumentId = createResult.data.documentId;

        // Add some initial text to replace
        await batchUpdateDocument(testDocumentId, [{
            insertText: {
                location: { index: 1 },
                text: 'Hello World! This is a test document with placeholder text.'
            }
        }], process.env.GOOGLE_DOCS_ACCESS_TOKEN);
    });

    it('should replace text in document', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            oldText: 'Hello World',
            newText: 'Hello Universe'
        };

        const result = await ReplaceText.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(typeof result.data.replacements, 'number');
        assert.strictEqual(result.port, 'out');
    });

    it('should replace text with match case', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            oldText: 'test',
            newText: 'TEST'
        };

        const result = await ReplaceText.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(typeof result.data.replacements, 'number');
        assert.strictEqual(result.port, 'out');
    });

    it('should handle text not found', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            oldText: 'NonExistentText123',
            newText: 'ReplacementText'
        };

        const result = await ReplaceText.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(result.data.replacements, 0);
        assert.strictEqual(result.port, 'out');
    });
});
