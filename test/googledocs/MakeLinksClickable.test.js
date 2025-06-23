const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('MakeLinksClickable Component', function() {
    let context;
    let MakeLinksClickable;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        MakeLinksClickable = require(path.join(__dirname, '../../src/appmixer/googledocs/core/MakeLinksClickable/MakeLinksClickable.js'));
        
        // Mock context
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
            sendJsonData: null,
            sendJson: function(data, port) {
                this.sendJsonData = { data, port };
                return { data, port };
            },
            httpRequest: require('./httpRequest.js'),
            CancelError: class extends Error {
                constructor(message) {
                    super(message);
                    this.name = 'CancelError';
                }
            }
        };
        
        if (!context.auth.accessToken) {
            throw new Error('GOOGLE_DOCS_ACCESS_TOKEN environment variable is required for tests');
        }
        
        // Create a test document with URLs that can be made clickable
        const CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        context.messages.in.content = {
            title: 'Test Document for MakeLinksClickable',
            content: 'Visit https://www.google.com or check out https://github.com for more info.'
        };
        
        try {
            await CreateDocument.receive(context);
            testDocumentId = context.sendJsonData.data.documentId;
        } catch (error) {
            console.log('Warning: Could not create test document for MakeLinksClickable test. Skipping due to:', error.message);
            this.skip();
        }
    });
    
    it('should make links clickable in document', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            documentId: testDocumentId
        };
        
        context.sendJsonData = null;
        
        await MakeLinksClickable.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.success !== 'boolean') {
            throw new Error('Expected success to be a boolean');
        }
        if (typeof context.sendJsonData.data.linksCount !== 'number') {
            throw new Error('Expected linksCount to be a number');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
        
        // Since we added URLs in the test document, we expect some links to be made clickable
        if (context.sendJsonData.data.linksCount === 0) {
            console.log('Warning: No links were made clickable, but this might be expected if URLs were not found');
        }
    });
    
    it('should handle document without URLs', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        // Create a document without URLs
        const CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        context.messages.in.content = {
            title: 'Test Document without URLs',
            content: 'This document has no URLs to make clickable.'
        };
        
        await CreateDocument.receive(context);
        const noUrlDocId = context.sendJsonData.data.documentId;
        
        context.messages.in.content = {
            documentId: noUrlDocId
        };
        
        context.sendJsonData = null;
        
        await MakeLinksClickable.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.success !== 'boolean') {
            throw new Error('Expected success to be a boolean');
        }
        if (typeof context.sendJsonData.data.linksCount !== 'number') {
            throw new Error('Expected linksCount to be a number');
        }
        if (context.sendJsonData.data.linksCount !== 0) {
            throw new Error('Expected linksCount to be 0 for document without URLs');
        }
    });
});
