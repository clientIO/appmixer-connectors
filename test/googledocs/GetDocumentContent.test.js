const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('GetDocumentContent Component', function() {
    let context;
    let GetDocumentContent;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        GetDocumentContent = require(path.join(__dirname, '../../src/appmixer/googledocs/core/GetDocumentContent/GetDocumentContent.js'));
        
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
            title: 'Test Document for GetContent Test',
            content: 'This is test content to retrieve.'
        };
        await CreateDocument.receive(context);
        testDocumentId = context.sendJsonData.data.documentId;
    });
    
    it('should get document content successfully', async function() {
        context.messages.in.content = {
            documentId: testDocumentId
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await GetDocumentContent.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.documentId !== 'string') {
            throw new Error('Expected documentId to be a string');
        }
        if (typeof context.sendJsonData.data.title !== 'string') {
            throw new Error('Expected title to be a string');
        }
        if (!context.sendJsonData.data.body || typeof context.sendJsonData.data.body !== 'object') {
            throw new Error('Expected body to be an object');
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
            await GetDocumentContent.receive(context);
            throw new Error('Expected request to fail with invalid document ID');
        } catch (error) {
            // Expected to fail - verify it's an HTTP error
            if (!error.response || !error.response.status) {
                throw new Error('Expected HTTP error response');
            }
        }
    });
});
