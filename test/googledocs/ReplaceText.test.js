const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('ReplaceText Component', function() {
    let context;
    let ReplaceText;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        ReplaceText = require(path.join(__dirname, '../../src/appmixer/googledocs/core/ReplaceText/ReplaceText.js'));
        
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
        
        // Create a test document with content first
        const CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        context.messages.in.content = {
            title: 'Test Document for ReplaceText Test',
            content: 'This is original text that will be replaced.'
        };
        await CreateDocument.receive(context);
        testDocumentId = context.sendJsonData.data.documentId;
    });
    
    it('should replace text successfully', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            oldText: 'original',
            newText: 'modified'
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await ReplaceText.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (!Array.isArray(context.sendJsonData.data.replies)) {
            throw new Error('Expected replies to be an array');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
        
        // Verify reply structure if replies exist
        if (context.sendJsonData.data.replies.length > 0) {
            const reply = context.sendJsonData.data.replies[0];
            if (!reply.replaceAllText || typeof reply.replaceAllText !== 'object') {
                throw new Error('Expected reply to have replaceAllText object');
            }
            if (typeof reply.replaceAllText.occurrencesChanged !== 'number') {
                throw new Error('Expected occurrencesChanged to be a number');
            }
        }
    });
    
    it('should handle text that does not exist', async function() {
        context.messages.in.content = {
            documentId: testDocumentId,
            oldText: 'nonexistent text',
            newText: 'replacement'
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await ReplaceText.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!Array.isArray(context.sendJsonData.data.replies)) {
            throw new Error('Expected replies to be an array');
        }
        
        // Should succeed but with 0 occurrences changed
        if (context.sendJsonData.data.replies.length > 0) {
            const reply = context.sendJsonData.data.replies[0];
            if (reply.replaceAllText && reply.replaceAllText.occurrencesChanged !== 0) {
                throw new Error('Expected 0 occurrences changed for nonexistent text');
            }
        }
    });
    
    it('should handle invalid document ID', async function() {
        context.messages.in.content = {
            documentId: 'invalid-document-id',
            oldText: 'test',
            newText: 'replacement'
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        try {
            await ReplaceText.receive(context);
            throw new Error('Expected request to fail with invalid document ID');
        } catch (error) {
            // Expected to fail - verify it's an HTTP error
            if (!error.response || !error.response.status) {
                throw new Error('Expected HTTP error response');
            }
        }
    });
});
