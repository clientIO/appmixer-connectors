const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('GetResponse Component', function() {
    let context;
    let GetResponse;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        GetResponse = require(path.join(__dirname, '../../src/appmixer/googleforms/core/GetResponse/GetResponse.js'));
        
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
            sendJson: function(data, port) {
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
    
    it('should throw error when formId is missing', async function() {
        context.messages.in.content = {
            responseId: 'some-response-id'
        };
        
        try {
            await GetResponse.receive(context);
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (error.name !== 'CancelError') {
                throw new Error('Expected CancelError');
            }
            if (!error.message.includes('Form ID is required')) {
                throw new Error('Expected error message to include "Form ID is required"');
            }
        }
    });
    
    it('should throw error when responseId is missing', async function() {
        context.messages.in.content = {
            formId: 'some-form-id'
        };
        
        try {
            await GetResponse.receive(context);
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (error.name !== 'CancelError') {
                throw new Error('Expected CancelError');
            }
            if (!error.message.includes('Response ID is required')) {
                throw new Error('Expected error message to include "Response ID is required"');
            }
        }
    });
});