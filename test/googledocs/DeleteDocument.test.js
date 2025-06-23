const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('DeleteDocument Component', function() {
    let context;
    let DeleteDocument;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        DeleteDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/DeleteDocument/DeleteDocument.js'));
        
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
        
        // Create a test document first
        const CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        context.messages.in.content = {
            title: 'Test Document for Deletion'
        };
        await CreateDocument.receive(context);
        testDocumentId = context.sendJsonData.data.documentId;
    });
    
    it('should delete document successfully', async function() {
        context.messages.in.content = {
            documentId: testDocumentId
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await DeleteDocument.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (context.sendJsonData.data.success !== true) {
            throw new Error('Expected success to be true');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should handle invalid document ID', async function() {
        context.messages.in.content = {
            documentId: 'invalid-document-id'
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        try {
            await DeleteDocument.receive(context);
            throw new Error('Expected request to fail with invalid document ID');
        } catch (error) {
            // Expected to fail - verify it's an HTTP error
            if (!error.response || !error.response.status) {
                throw new Error('Expected HTTP error response');
            }
        }
    });
});
