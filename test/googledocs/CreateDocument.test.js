const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('CreateDocument Component', function() {
    let context;
    let CreateDocument;
    
    this.timeout(30000);
    
    before(function() {
        // Load the component
        CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        
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
    });
    
    it('should create a document with title only', async function() {
        context.messages.in.content = {
            title: 'Test Document Created by Automated Test'
        };
        
        await CreateDocument.receive(context);
        
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
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
        
        // Clean up: store document ID for potential cleanup
        global.testDocumentId = context.sendJsonData.data.documentId;
    });
    
    it('should create a document with title and content', async function() {
        context.messages.in.content = {
            title: 'Test Document with Content',
            content: 'This is test content for the document.'
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await CreateDocument.receive(context);
        
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
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should create a document with default title when title is empty', async function() {
        context.messages.in.content = {
            title: ''
        };
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await CreateDocument.receive(context);
        
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
    });
});
