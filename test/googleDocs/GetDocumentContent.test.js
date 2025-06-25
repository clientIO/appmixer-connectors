'use strict';

const assert = require('assert');
const path = require('path');
const { createTestDocument } = require('./testHelpers');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const GetDocumentContent = require('../../src/appmixer/googleDocs/core/GetDocumentContent/GetDocumentContent.js');

describe('GetDocumentContent', function() {

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
        // Create a test document first
        const createResult = await createTestDocument(
            'Test Document for GetContent ' + Date.now(),
            process.env.GOOGLE_DOCS_ACCESS_TOKEN
        );
        testDocumentId = createResult.data.documentId;
    });

    it('should get document content by ID', async function() {
        context.messages.in.content = {
            documentId: testDocumentId
        };

        const result = await GetDocumentContent.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert(result.data.title, 'Document title should be returned');
        assert(result.data.body, 'Document body should be returned');
        assert.strictEqual(typeof result.data.body, 'object');
        assert.strictEqual(result.port, 'out');
    });

    it('should handle invalid document ID gracefully', async function() {
        context.messages.in.content = {
            documentId: 'invalid-document-id'
        };

        try {
            await GetDocumentContent.receive(context);
            assert.fail('Should have thrown an error for invalid document ID');
        } catch (error) {
            assert(error, 'Should throw an error for invalid document ID');
        }
    });
});
