const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('DownloadDocument Component', function() {
    let context;
    let DownloadDocument;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        DownloadDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/DownloadDocument/DownloadDocument.js'));
        
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
            title: 'Test Document for Download',
            content: 'This is test content for download.'
        };
        
        try {
            await CreateDocument.receive(context);
            testDocumentId = context.sendJsonData.data.documentId;
        } catch (error) {
            console.log('Warning: Could not create test document for download test. Skipping DownloadDocument tests due to:', error.message);
            this.skip();
        }
    });
    
    it('should download document as PDF', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            documentId: testDocumentId,
            format: 'pdf'
        };
        
        context.sendJsonData = null;
        
        await DownloadDocument.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.content !== 'string') {
            throw new Error('Expected content to be a string');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should download document as text', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            documentId: testDocumentId,
            format: 'txt'
        };
        
        context.sendJsonData = null;
        
        await DownloadDocument.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.content !== 'string') {
            throw new Error('Expected content to be a string');
        }
    });
    
    it('should download document as HTML', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            documentId: testDocumentId,
            format: 'html'
        };
        
        context.sendJsonData = null;
        
        await DownloadDocument.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.content !== 'string') {
            throw new Error('Expected content to be a string');
        }
    });
});
