const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('UpdateForm Component', function() {
    let context;
    let UpdateForm;
    let CreateForm;
    let testFormId;

    this.timeout(60000);

    before(async function() {
        // Skip all tests if access token is not set
        if (!process.env.GOOGLE_FORMS_ACCESS_TOKEN) {
            console.log('Skipping FindResponses tests - GOOGLE_FORMS_ACCESS_TOKEN not set');
            this.skip();
        }

        // Load the components
        UpdateForm = require(path.join(__dirname, '../../src/appmixer/googleForms/core/UpdateForm/UpdateForm.js'));
        CreateForm = require(path.join(__dirname, '../../src/appmixer/googleForms/core/CreateForm/CreateForm.js'));

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
        assert(testFormId, 'No test form ID available');

        const newTitle = 'Updated Test Form - ' + Date.now();
        context.messages.in.content = {
            formId: testFormId,
            title: newTitle
        };

        const result = await UpdateForm.receive(context);

        assert(result && typeof result === 'object', 'Expected result to be an object');
        assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
        assert.strictEqual(result.data.success, true, 'Expected result.data.success to be true');
        assert.strictEqual(result.data.formId, testFormId, 'Expected formId to match input');
        assert(result.data.message.includes('successfully updated'), 'Expected success message');
        assert(Array.isArray(result.data.updatedFields), 'Expected updatedFields to be an array');
        assert(result.data.updatedFields.includes('title'), 'Expected updatedFields to include "title"');
        assert.strictEqual(result.port, 'out', 'Expected port to be "out"');
    });

    it('should throw error when formId is missing', async function() {

        context.messages.in.content = {
            title: 'Some title'
        };

        try {
            await UpdateForm.receive(context);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.strictEqual(error.name, 'CancelError', 'Expected CancelError');
            assert(error.message.includes('Form ID is required'), 'Expected error message to include "Form ID is required"');
        }
    });
});
