const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('GetForm Component', function() {
    let context;
    let GetForm;
    let testFormId;

    this.timeout(30000);

    before(async function() {
        // Skip all tests if access token is not set
        if (!process.env.GOOGLE_FORMS_ACCESS_TOKEN) {
            console.log('Skipping FindResponses tests - GOOGLE_FORMS_ACCESS_TOKEN not set');
            this.skip();
        }

        // Load the component
        GetForm = require(path.join(__dirname, '../../src/appmixer/googleForms/core/GetForm/GetForm.js'));

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

        assert(testFormId, 'No test form ID available');

        context.messages.in.content = {
            formId: testFormId
        };

        const result = await GetForm.receive(context);

        assert(result && typeof result === 'object', 'Expected result to be an object');
        assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
        assert.strictEqual(result.data.formId, testFormId, 'Expected formId to match input');
        assert(result.data.info && typeof result.data.info === 'object', 'Expected result.data.info to be an object');
        assert(result.data.info.title && typeof result.data.info.title === 'string', 'Expected result.data.info.title to be a string');
        assert(result.data.responderUri && typeof result.data.responderUri === 'string', 'Expected result.data.responderUri to be a string');
        assert.strictEqual(result.port, 'out', 'Expected port to be "out"');
    });
});
