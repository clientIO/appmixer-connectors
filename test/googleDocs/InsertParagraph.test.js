'use strict';

const assert = require('assert');
const path = require('path');
const { createTestDocument } = require('./testHelpers');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const InsertParagraph = require('../../src/appmixer/googleDocs/core/InsertParagraph/InsertParagraph.js');

describe('InsertParagraph', function() {

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
            'Test Document for InsertParagraph ' + Date.now(),
            process.env.GOOGLE_DOCS_ACCESS_TOKEN
        );
        testDocumentId = createResult.data.documentId;
    });

    it('should insert a paragraph at the beginning', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            text: 'This is a test paragraph inserted at the beginning.',
            location: 'BEGINNING'
        };

        const result = await InsertParagraph.receive(context);
        
        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');
    });

    it('should insert a paragraph at the end', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            text: 'This is a test paragraph inserted at the end.',
            location: 'END'
        };

        const result = await InsertParagraph.receive(context);
        
        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');
    });

    it('should insert a paragraph at a specific index', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            text: 'This is a test paragraph inserted at index 1.',
            location: 'INDEX',
            index: 1
        };

        const result = await InsertParagraph.receive(context);
        
        assert(result.data.documentId, 'Document ID should be returned');
        assert.strictEqual(result.data.success, true);
        assert.strictEqual(result.port, 'out');
    });
});
