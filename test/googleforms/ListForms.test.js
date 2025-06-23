const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('ListForms Component', function() {
    let context;
    let ListForms;
    
    this.timeout(30000);
    
    before(function() {
        // Load the component
        ListForms = require(path.join(__dirname, '../../src/appmixer/googleforms/core/ListForms/ListForms.js'));
        
        // Mock context
        context = {
            auth: {
                accessToken: process.env.GOOGLE_FORMS_ACCESS_TOKEN
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
            throw new Error('GOOGLE_FORMS_ACCESS_TOKEN environment variable is required for tests');
        }
    });
    
    it('should list forms with array output type', async function() {
        context.messages.in.content = {
            outputType: 'array'
        };
        
        await ListForms.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (!Array.isArray(context.sendJsonData.data.result)) {
            throw new Error('Expected sendJsonData.data.result to be an array');
        }
        if (typeof context.sendJsonData.data.count !== 'number') {
            throw new Error('Expected sendJsonData.data.count to be a number');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
        
        if (context.sendJsonData.data.result.length > 0) {
            const form = context.sendJsonData.data.result[0];
            if (!form.id) {
                throw new Error('Expected form to have id property');
            }
            if (!form.name) {
                throw new Error('Expected form to have name property');
            }
            if (!form.mimeType) {
                throw new Error('Expected form to have mimeType property');
            }
            if (form.mimeType !== 'application/vnd.google-apps.form') {
                throw new Error('Expected mimeType to be application/vnd.google-apps.form');
            }
        }
    });
    
    it('should default to array output type when not specified', async function() {
        context.messages.in.content = {};
        
        // Reset sendJsonData for this test
        context.sendJsonData = null;
        
        await ListForms.receive(context);
        
        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (!Array.isArray(context.sendJsonData.data.result)) {
            throw new Error('Expected sendJsonData.data.result to be an array');
        }
        if (typeof context.sendJsonData.data.count !== 'number') {
            throw new Error('Expected sendJsonData.data.count to be a number');
        }
    });
});