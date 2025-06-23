const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('InsertParagraph Component', function() {
    let context;
    let InsertParagraph;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        InsertParagraph = require(path.join(__dirname, '../../src/appmixer/googledocs/core/InsertParagraph/InsertParagraph.js'));
        
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
            title: 'Test Document for InsertParagraph Test'
        };
        await CreateDocument.receive(context);
        testDocumentId = context.sendJsonData.data.documentId;
    });
    
    it('should insert paragraph successfully', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            paragraphText: 'This is a test paragraph inserted by automated test.',
            insertionIndex: 1
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await InsertParagraph.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.success !== 'boolean') {
            throw new Error('Expected success to be a boolean');
        }
        if (typeof context.sendJsonData.data.documentId !== 'string') {
            throw new Error('Expected documentId to be a string');
        }
        if (typeof context.sendJsonData.data.insertedText !== 'string') {
            throw new Error('Expected insertedText to be a string');
        }
        if (!Array.isArray(context.sendJsonData.data.replies)) {
            throw new Error('Expected replies to be an array');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
        
        // Log the actual response for debugging
        console.log('Actual response:', JSON.stringify(context.sendJsonData.data, null, 2));
    });
    
    it('should handle invalid document ID', async function() {
        context.messages.in.content = {
            documentId: 'invalid-document-id',
            paragraphText: 'Test text',
            insertionIndex: 1
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        try {
            await InsertParagraph.receive(context);
            throw new Error('Expected request to fail with invalid document ID');
        } catch (error) {
            // Expected to fail - verify it's an HTTP error
            if (!error.response || !error.response.status) {
                throw new Error('Expected HTTP error response');
            }
        }
    });
});
