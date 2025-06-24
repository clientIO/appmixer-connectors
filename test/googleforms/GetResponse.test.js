const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

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
        
        assert(context.auth.accessToken, 'GOOGLE_FORMS_ACCESS_TOKEN environment variable is required for tests');
    });
    
    it('should throw error when formId is missing', async function() {
        context.messages.in.content = {
            responseId: 'some-response-id'
        };
        
        try {
            await GetResponse.receive(context);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.strictEqual(error.name, 'CancelError', 'Expected CancelError');
            assert(error.message.includes('Form ID is required'), 'Expected error message to include "Form ID is required"');
        }
    });
    
    it('should throw error when responseId is missing', async function() {
        context.messages.in.content = {
            formId: 'some-form-id'
        };
        
        try {
            await GetResponse.receive(context);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.strictEqual(error.name, 'CancelError', 'Expected CancelError');
            assert(error.message.includes('Response ID is required'), 'Expected error message to include "Response ID is required"');
        }
    });
});
