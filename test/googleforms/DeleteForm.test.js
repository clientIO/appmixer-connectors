const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('DeleteForm Component', function() {
    let context;
    let DeleteForm;
    let CreateForm;
    let testFormId;
    
    this.timeout(60000);
    
    before(async function() {
        // Load the components
        DeleteForm = require(path.join(__dirname, '../../src/appmixer/googleforms/core/DeleteForm/DeleteForm.js'));
        CreateForm = require(path.join(__dirname, '../../src/appmixer/googleforms/core/CreateForm/CreateForm.js'));
        
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
    
    beforeEach(async function() {
        // Create a test form for deletion before each test
        try {
            context.messages.in.content = {
                title: 'Test Form for Deletion - ' + Date.now()
            };
            
            const createResult = await CreateForm.receive(context);
            testFormId = createResult.data.formId;
        } catch (error) {
            console.warn('Could not create test form:', error.message);
        }
    });
    
    it('should delete form successfully', async function() {
        if (!testFormId) {
            this.skip('No test form ID available');
        }
        
        context.messages.in.content = {
            formId: testFormId
        };
        
        const result = await DeleteForm.receive(context);
        
        if (!result || typeof result !== 'object') {
            throw new Error('Expected result to be an object');
        }
        if (!result.data || typeof result.data !== 'object') {
            throw new Error('Expected result.data to be an object');
        }
        if (result.data.success !== true) {
            throw new Error('Expected result.data.success to be true');
        }
        if (result.data.formId !== testFormId) {
            throw new Error('Expected formId to match input');
        }
        if (!result.data.message.includes('successfully moved to trash')) {
            throw new Error('Expected success message');
        }
        if (result.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should throw error when formId is missing', async function() {
        context.messages.in.content = {};
        
        try {
            await DeleteForm.receive(context);
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
});