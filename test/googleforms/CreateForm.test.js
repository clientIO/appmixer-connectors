const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

        if (!context.auth.accessToken) {
            throw new Error('GOOGLE_FORMS_ACCESS_TOKEN environment variable is required for tests');
        }
    });

    it('should create a form with title only', async function() {
        context.messages.in.content = {
            title: 'Test Form - ' + Date.now()
        };

        const result = await CreateForm.receive(context);

        console.log(result);
        if (!result || typeof result !== 'object') {
            throw new Error('Expected result to be an object');
        }
        if (!result.data || typeof result.data !== 'object') {
            throw new Error('Expected result.data to be an object');
        }
        if (!result.data.formId || typeof result.data.formId !== 'string') {
            throw new Error('Expected result.data.formId to be a string');
        }
        if (!result.data.info || typeof result.data.info !== 'object') {
            throw new Error('Expected result.data.info to be an object');
        }
        if (result.data.info.title !== context.messages.in.content.title) {
            throw new Error('Expected title to match input');
        }
        if (!result.data.responderUri || typeof result.data.responderUri !== 'string') {
            throw new Error('Expected result.data.responderUri to be a string');
        }
        if (result.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });

    it('should create a form with title and document title', async function() {
        const timestamp = Date.now();
        context.messages.in.content = {
            title: 'Test Form - ' + timestamp,
            documentTitle: 'Test Document - ' + timestamp
        };

        const result = await CreateForm.receive(context);

        if (!result || typeof result !== 'object') {
            throw new Error('Expected result to be an object');
        }
        if (!result.data || typeof result.data !== 'object') {
            throw new Error('Expected result.data to be an object');
        }
        if (!result.data.formId || typeof result.data.formId !== 'string') {
            throw new Error('Expected result.data.formId to be a string');
        }
        if (result.data.info.title !== context.messages.in.content.title) {
            throw new Error('Expected title to match input');
        }
        if (result.data.info.documentTitle !== context.messages.in.content.documentTitle) {
            throw new Error('Expected documentTitle to match input');
        }
    });

    it('should throw error when title is missing', async function() {
        context.messages.in.content = {};

        try {
            await CreateForm.receive(context);
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (error.name !== 'CancelError') {
                throw new Error('Expected CancelError');
            }
            if (!error.message.toLowerCase().includes('title')) {
                throw new Error('Expected error message to include "title"');
            }
        }
    });
});