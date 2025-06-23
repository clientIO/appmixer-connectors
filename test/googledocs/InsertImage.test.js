const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('InsertImage Component', function() {
    let context;
    let InsertImage;
    let testDocumentId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        InsertImage = require(path.join(__dirname, '../../src/appmixer/googledocs/core/InsertImage/InsertImage.js'));
        
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
            title: 'Test Document for InsertImage',
            content: 'This document will have an image inserted.'
        };
        
        try {
            await CreateDocument.receive(context);
            testDocumentId = context.sendJsonData.data.documentId;
        } catch (error) {
            console.log('Warning: Could not create test document for InsertImage test. Skipping InsertImage tests due to:', error.message);
            this.skip();
        }
    });
    
    it('should insert image from URL', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            documentId: testDocumentId,
            imageUrl: 'https://via.placeholder.com/300x200',
            index: 1
        };
        
        context.sendJsonData = null;
        
        await InsertImage.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.success !== 'boolean') {
            throw new Error('Expected success to be a boolean');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should insert image with dimensions', async function() {
        if (!testDocumentId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            documentId: testDocumentId,
            imageUrl: 'https://via.placeholder.com/400x300',
            index: 50,
            width: 200,
            height: 150
        };
        
        context.sendJsonData = null;
        
        await InsertImage.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.success !== 'boolean') {
            throw new Error('Expected success to be a boolean');
        }
    });
});
