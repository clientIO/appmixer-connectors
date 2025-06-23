const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('MakeAPICall Component', function() {
    let context;
    let MakeAPICall;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        MakeAPICall = require(path.join(__dirname, '../../src/appmixer/googledocs/core/MakeAPICall/MakeAPICall.js'));
        
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
        
        // Create a test document for API calls
        const CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        context.messages.in.content = {
            title: 'Test Document for MakeAPICall',
            content: 'This document is for testing API calls.'
        };
        
        try {
            await CreateDocument.receive(context);
            testDocumentId = context.sendJsonData.data.documentId;
        } catch (error) {
            console.log('Warning: Could not create test document for MakeAPICall test. Skipping due to:', error.message);
            this.skip();
        }
    });
    
    it('should make GET API call with relative URL', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            url: `documents/${testDocumentId}`,
            method: 'GET'
        };
        
        context.sendJsonData = null;
        
        await MakeAPICall.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.status !== 'number') {
            throw new Error('Expected status to be a number');
        }
        if (typeof context.sendJsonData.data.data !== 'object') {
            throw new Error('Expected data to be an object');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
        
        // Should return 200 status for successful GET
        if (context.sendJsonData.data.status !== 200) {
            throw new Error(`Expected status 200, got ${context.sendJsonData.data.status}`);
        }
    });
    
    it('should make GET API call with full URL', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            url: `https://docs.googleapis.com/v1/documents/${testDocumentId}`,
            method: 'GET'
        };
        
        context.sendJsonData = null;
        
        await MakeAPICall.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.status !== 'number') {
            throw new Error('Expected status to be a number');
        }
        if (context.sendJsonData.data.status !== 200) {
            throw new Error(`Expected status 200, got ${context.sendJsonData.data.status}`);
        }
    });
    
    it('should make POST API call with data', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        // Test batch update API call
        context.messages.in.content = {
            url: `documents/${testDocumentId}:batchUpdate`,
            method: 'POST',
            data: {
                requests: [{
                    insertText: {
                        location: { index: 1 },
                        text: 'API test text'
                    }
                }]
            }
        };
        
        context.sendJsonData = null;
        
        await MakeAPICall.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.status !== 'number') {
            throw new Error('Expected status to be a number');
        }
        
        // Should return 200 status for successful POST
        if (context.sendJsonData.data.status !== 200) {
            throw new Error(`Expected status 200, got ${context.sendJsonData.data.status}`);
        }
    });
    
    it('should handle custom headers', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            url: `documents/${testDocumentId}`,
            method: 'GET',
            headers: {
                'X-Custom-Header': 'test-value'
            }
        };
        
        context.sendJsonData = null;
        
        await MakeAPICall.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (context.sendJsonData.data.status !== 200) {
            throw new Error(`Expected status 200, got ${context.sendJsonData.data.status}`);
        }
    });
});
