'use strict';

const assert = require('assert');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DeleteDocument = require('../../src/appmixer/googleDocs/core/DeleteDocument/DeleteDocument.js');

describe('DeleteDocument', function() {

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
                                const jsonData = JSON.parse(data || '{}');
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

    it('should delete a document', async function() {
        // First create a document to delete
        const createResult = await context.httpRequest({
            method: 'POST',
            url: 'https://docs.googleapis.com/v1/documents',
            headers: {
                'Authorization': `Bearer ${process.env.GOOGLE_DOCS_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                title: 'Test Document for Deletion ' + Date.now()
            }
        });

        const documentId = createResult.data.documentId;

        context.messages.in.content = {
            documentId: documentId
        };

        const result = await DeleteDocument.receive(context);

        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');
    });

    it('should handle invalid document ID', async function() {
        context.messages.in.content = {
            documentId: 'invalid-document-id'
        };

        try {
            await DeleteDocument.receive(context);
            assert.fail('Should have thrown an error for invalid document ID');
        } catch (error) {
            assert(error, 'Should throw an error for invalid document ID');
        }
    });
});
