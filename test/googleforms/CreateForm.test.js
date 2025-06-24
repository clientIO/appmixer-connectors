const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('CreateForm Component', function() {
    let context;
    let CreateForm;

    this.timeout(30000);

    before(function() {
        // Load the component
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

        assert(context.auth.accessToken, 'GOOGLE_FORMS_ACCESS_TOKEN environment variable is required for tests');
    });

    it('should create a form with title only', async function() {
        context.messages.in.content = {
            title: 'Test Form - ' + Date.now()
        };

        try {
            const result = await CreateForm.receive(context);

            console.log('CreateForm result:', JSON.stringify(result, null, 2));

            assert(result && typeof result === 'object', 'Expected result to be an object');
            assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
            assert(result.data.formId && typeof result.data.formId === 'string', 'Expected result.data.formId to be a string');
            assert(result.data.info && typeof result.data.info === 'object', 'Expected result.data.info to be an object');
            assert.strictEqual(result.data.info.title, context.messages.in.content.title, `Expected title to match input. Got: ${result.data.info.title}, Expected: ${context.messages.in.content.title}`);
            assert(result.data.responderUri && typeof result.data.responderUri === 'string', 'Expected result.data.responderUri to be a string');
            assert.strictEqual(result.port, 'out', 'Expected port to be "out"');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            throw error;
        }
    });

    it('should create a form with title and document title', async function() {
        const timestamp = Date.now();
        context.messages.in.content = {
            title: 'Test Form - ' + timestamp,
            documentTitle: 'Test Document - ' + timestamp
        };

        try {
            const result = await CreateForm.receive(context);

            console.log('CreateForm with documentTitle result:', JSON.stringify(result, null, 2));

            assert(result && typeof result === 'object', 'Expected result to be an object');
            assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
            assert(result.data.formId && typeof result.data.formId === 'string', 'Expected result.data.formId to be a string');
            assert.strictEqual(result.data.info.title, context.messages.in.content.title, `Expected title to match input. Got: ${result.data.info.title}, Expected: ${context.messages.in.content.title}`);
            assert.strictEqual(result.data.info.documentTitle, context.messages.in.content.documentTitle, `Expected documentTitle to match input. Got: ${result.data.info.documentTitle}, Expected: ${context.messages.in.content.documentTitle}`);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            throw error;
        }
    });

    it('should throw error when title is missing', async function() {
        context.messages.in.content = {};

        try {
            await CreateForm.receive(context);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.strictEqual(error.name, 'CancelError', `Expected CancelError, got: ${error.name}`);
            assert(error.message.toLowerCase().includes('title'), `Expected error message to include "title", got: ${error.message}`);
        }
    });

    it('should throw error when title is empty string', async function() {
        context.messages.in.content = {
            title: ''
        };

        try {
            await CreateForm.receive(context);
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.strictEqual(error.name, 'CancelError', `Expected CancelError, got: ${error.name}`);
            assert(error.message.toLowerCase().includes('title'), `Expected error message to include "title", got: ${error.message}`);
        }
    });
});
