const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('GetForm Component', function() {
    let context;
    let GetForm;
    let testFormId;

    this.timeout(30000);

    before(async function() {
        // Load the component
        GetForm = require(path.join(__dirname, '../../src/appmixer/googleforms/core/GetForm/GetForm.js'));

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

        // Get a test form ID by listing forms
        try {
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://www.googleapis.com/drive/v3/files',
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                },
                params: {
                    q: 'mimeType=\'application/vnd.google-apps.form\'',
                    fields: 'files(id)',
                    pageSize: 1
                }
            });

            if (response.data && response.data.files && response.data.files.length > 0) {
                testFormId = response.data.files[0].id;
            }
        } catch (error) {
            console.warn('Could not get test form ID:', error.message);
        }
    });

    it('should get form by ID', async function() {
        if (!testFormId) {
            this.skip('No test form ID available');
        }

        context.messages.in.content = {
            formId: testFormId
        };

        const result = await GetForm.receive(context);

        if (!result || typeof result !== 'object') {
            throw new Error('Expected result to be an object');
        }
        if (!result.data || typeof result.data !== 'object') {
            throw new Error('Expected result.data to be an object');
        }
        if (result.data.formId !== testFormId) {
            throw new Error('Expected formId to match input');
        }
        if (!result.data.info || typeof result.data.info !== 'object') {
            throw new Error('Expected result.data.info to be an object');
        }
        if (!result.data.info.title || typeof result.data.info.title !== 'string') {
            throw new Error('Expected result.data.info.title to be a string');
        }
        if (!result.data.responderUri || typeof result.data.responderUri !== 'string') {
            throw new Error('Expected result.data.responderUri to be a string');
        }
        if (result.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }

        // Check that form property is added
        if (!result.data.form || typeof result.data.form !== 'object') {
            throw new Error('Expected result.data.form to be an object');
        }
        if (result.data.form.formId !== testFormId) {
            throw new Error('Expected form.formId to match input');
        }
    });

    it('should throw error when formId is missing', async function() {
        context.messages.in.content = {};

        try {
            await GetForm.receive(context);
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