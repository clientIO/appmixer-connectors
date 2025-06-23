const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('CreateDocumentfromTemplate Component', function() {
    let context;
    let CreateDocumentfromTemplate;
    let testTemplateId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        CreateDocumentfromTemplate = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocumentfromTemplate/CreateDocumentfromTemplate.js'));
        
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
        
        // Create a test template document first
        const CreateDocument = require(path.join(__dirname, '../../src/appmixer/googledocs/core/CreateDocument/CreateDocument.js'));
        context.messages.in.content = {
            title: 'Test Template for CreateDocumentfromTemplate',
            content: 'Hello {{name}}, this is a template with {{placeholder}} text.'
        };
        
        try {
            await CreateDocument.receive(context);
            testTemplateId = context.sendJsonData.data.documentId;
        } catch (error) {
            console.log('Warning: Could not create template document for test. Skipping CreateDocumentfromTemplate tests due to:', error.message);
            this.skip();
        }
    });
    
    it('should create document from template with replacements', async function() {
        if (!testTemplateId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            templateId: testTemplateId,
            newDocumentName: 'Test Document from Template',
            replacements: {
                'name': 'John Doe',
                'placeholder': 'replacement'
            }
        };
        
        context.sendJsonData = null;
        
        await CreateDocumentfromTemplate.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.id !== 'string') {
            throw new Error('Expected id to be a string');
        }
        if (typeof context.sendJsonData.data.name !== 'string') {
            throw new Error('Expected name to be a string');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should create document from template without replacements', async function() {
        if (!testTemplateId) {
            this.skip();
            return;
        }
        
        context.messages.in.content = {
            templateId: testTemplateId,
            newDocumentName: 'Test Document from Template - No Replacements'
        };
        
        context.sendJsonData = null;
        
        await CreateDocumentfromTemplate.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (typeof context.sendJsonData.data.id !== 'string') {
            throw new Error('Expected id to be a string');
        }
        if (typeof context.sendJsonData.data.name !== 'string') {
            throw new Error('Expected name to be a string');
        }
    });
});
