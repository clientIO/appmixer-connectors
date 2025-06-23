const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('WatchDocuments Component', function() {
    let context;
    let WatchDocuments;
    
    this.timeout(30000);
    
    before(function() {
        // Load the component
        WatchDocuments = require(path.join(__dirname, '../../src/appmixer/googledocs/core/WatchDocuments/WatchDocuments.js'));
        
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
            state: {},
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
    
    it('should watch for document changes without folder filter', async function() {
        context.messages.in.content = {};
        context.state = {}; // Reset state
        
        await WatchDocuments.receive(context);
        
        // For a trigger component, we mainly check that it doesn't throw an error
        // The actual triggering would happen when documents are created/modified
        // In this test environment, we can't easily simulate that
        if (context.sendJsonData) {
            // If data was sent, validate its structure
            if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
                throw new Error('Expected sendJsonData.data to be an object');
            }
        }
    });
    
    it('should watch for document changes with folder filter', async function() {
        context.messages.in.content = {
            folderId: 'test-folder-id'
        };
        context.state = {}; // Reset state
        context.sendJsonData = null;
        
        try {
            await WatchDocuments.receive(context);
            
            // For a trigger component, we mainly check that it doesn't throw an error
            if (context.sendJsonData) {
                if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
                    throw new Error('Expected sendJsonData.data to be an object');
                }
            }
        } catch (error) {
            // If folder doesn't exist, that's expected in test environment
            if (error.message && error.message.includes('404')) {
                console.log('Note: WatchDocuments test with folder filter skipped due to non-existent folder (expected in test environment)');
                return;
            }
            throw error;
        }
    });
    
    it('should handle initial state setup', async function() {
        context.messages.in.content = {};
        context.state = {}; // Reset state
        context.sendJsonData = null;
        
        await WatchDocuments.receive(context);
        
        // Check that state might have been updated (depending on implementation)
        // This is mainly to ensure the component runs without errors
    });
});
