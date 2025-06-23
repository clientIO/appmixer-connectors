const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('UpdateForm Component', function() {
    let context;
    let UpdateForm;
    let CreateForm;
    let testFormId;
    
    this.timeout(60000);
    
    before(async function() {
        // Load the components
        UpdateForm = require(path.join(__dirname, '../../src/appmixer/googleforms/core/UpdateForm/UpdateForm.js'));
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
        
        // Create a test form for updating
        try {
            context.messages.in.content = {
                title: 'Test Form for Update - ' + Date.now()
            };
            
            const createResult = await CreateForm.receive(context);
            testFormId = createResult.data.formId;
        } catch (error) {
            console.warn('Could not create test form:', error.message);
        }
    });
    
    it('should update form title', async function() {
        if (!testFormId) {
            this.skip('No test form ID available');
        }
        
        const newTitle = 'Updated Test Form - ' + Date.now();
        context.messages.in.content = {
            formId: testFormId,
            title: newTitle
        };
        
        const result = await UpdateForm.receive(context);
        
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
        if (!result.data.message.includes('successfully updated')) {
            throw new Error('Expected success message');
        }
        if (!Array.isArray(result.data.updatedFields)) {
            throw new Error('Expected updatedFields to be an array');
        }
        if (!result.data.updatedFields.includes('title')) {
            throw new Error('Expected updatedFields to include "title"');
        }
        if (result.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should throw error when formId is missing', async function() {
        context.messages.in.content = {
            title: 'Some title'
        };
        
        try {
            await UpdateForm.receive(context);
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
    
    it('should throw error when no fields to update', async function() {
        context.messages.in.content = {
            formId: testFormId || 'test-id'
        };
        
        try {
            await UpdateForm.receive(context);
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (error.name !== 'CancelError') {
                throw new Error('Expected CancelError');
            }
            if (!error.message.includes('At least one field to update must be provided')) {
                throw new Error('Expected error about missing fields');
            }
        }
    });
});