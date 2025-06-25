'use strict';

const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const createDocComponent = require('../../src/appmixer/googleDocs/core/CreateDocument/CreateDocument');
const component = require('../../src/appmixer/googleDocs/core/DownloadDocument/DownloadDocument');

describe('DownloadDocument', function() {

    this.timeout(30000);

    let context;
    let testDocumentId;

    before(async function() {
        // Skip all tests if the access token is not set
        if (!process.env.GOOGLE_DOCS_ACCESS_TOKEN) {
            console.log('Skipping FindResponses tests - GOOGLE_DOCS_ACCESS_TOKEN not set');
            this.skip();
        }

        // Create a test document first
        const createContext = {
            messages: {
                in: {
                    content: {
                        title: 'Test Document for Download',
                        content: 'This document will be downloaded in various formats.'
                    }
                }
            },
            auth: {
                accessToken: process.env.GOOGLE_DOCS_ACCESS_TOKEN
            },
            httpRequest: require('axios'),
            sendJson: function(data, port) {
                return { data, port };
            }
        };

        const createResult = await createDocComponent.receive(createContext);
        testDocumentId = createResult.data.documentId;
    });

    after(async function() {
        // Clean up test document
        if (testDocumentId) {
            try {
                await require('axios')({
                    method: 'DELETE',
                    url: `https://www.googleapis.com/drive/v3/files/${testDocumentId}`,
                    headers: {
                        'Authorization': `Bearer ${process.env.GOOGLE_DOCS_ACCESS_TOKEN}`
                    }
                });
            } catch (error) {
                console.warn('Failed to clean up test document:', error.message);
            }
        }
    });

    beforeEach(function() {
        context = {
            messages: {
                in: {
                    content: {}
                }
            },
            auth: {
                accessToken: process.env.GOOGLE_DOCS_ACCESS_TOKEN
            },
            httpRequest: require('axios'),
            sendJson: function(data, port) {
                return { data, port };
            }
        };
    });

    it('should download document as PDF', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            format: 'pdf'
        };

        const result = await component.receive(context);

        assert(result.data, 'Should return data');
        assert(result.data.fileData, 'Should return file data');
        assert(result.data.fileName, 'Should return file name');
        assert.strictEqual(result.port, 'out');

        // Verify types
        assert.strictEqual(typeof result.data.fileName, 'string');
        assert(result.data.fileName.includes('.pdf'), 'File name should include .pdf extension');
    });

    it('should download document as DOCX', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            format: 'docx'
        };

        const result = await component.receive(context);

        assert(result.data, 'Should return data');
        assert(result.data.fileData, 'Should return file data');
        assert(result.data.fileName, 'Should return file name');
        assert.strictEqual(result.port, 'out');

        // Verify types
        assert.strictEqual(typeof result.data.fileName, 'string');
        assert(result.data.fileName.includes('.docx'), 'File name should include .docx extension');
    });

    it('should download document as plain text', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            format: 'txt'
        };

        const result = await component.receive(context);

        assert(result.data, 'Should return data');
        assert(result.data.fileData, 'Should return file data');
        assert(result.data.fileName, 'Should return file name');
        assert.strictEqual(result.port, 'out');

        // Verify types
        assert.strictEqual(typeof result.data.fileName, 'string');
        assert(result.data.fileName.includes('.txt'), 'File name should include .txt extension');
    });
});
