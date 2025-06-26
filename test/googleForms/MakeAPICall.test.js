const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('MakeAPICall Component', function() {
    let context;
    let MakeAPICall;
    let testFormId;

    this.timeout(30000);

    before(async function() {
        // Skip all tests if the access token is not set
        if (!process.env.GOOGLE_FORMS_ACCESS_TOKEN) {
            console.log('Skipping tests - GOOGLE_FORMS_ACCESS_TOKEN not set');
            this.skip();
        }
        // Load the component
        MakeAPICall = require(path.join(__dirname, '../../src/appmixer/googleForms/core/MakeAPICall/MakeAPICall.js'));

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

        // Get a test form ID for API calls
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

    it('should make GET API call', async function() {

        assert(testFormId, 'No test form ID available');

        context.messages.in.content = {
            method: 'GET',
            url: `https://forms.googleapis.com/v1/forms/${testFormId}`
        };

        const result = await MakeAPICall.receive(context);

        assert(result && typeof result === 'object', 'Expected result to be an object');
        assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
        assert.strictEqual(result.data.statusCode, 200, 'Expected statusCode to be 200');
        assert(result.data.body && typeof result.data.body === 'object', 'Expected result.data.body to be an object');
        assert.strictEqual(result.data.body.formId, testFormId, 'Expected body.formId to match test form ID');
        assert(result.data.headers && typeof result.data.headers === 'object', 'Expected result.data.headers to be an object');
        assert(result.data.response && typeof result.data.response === 'object', 'Expected result.data.response to be an object');
        assert.strictEqual(result.port, 'out', 'Expected port to be "out"');
    });

    it('should make POST API call to create form', async function() {

        const formTitle = 'API Test Form - ' + Date.now();

        context.messages.in.content = {
            method: 'POST',
            url: 'https://forms.googleapis.com/v1/forms',
            body: JSON.stringify({
                info: {
                    title: formTitle
                }
            })
        };

        const result = await MakeAPICall.receive(context);

        assert(result && typeof result === 'object', 'Expected result to be an object');
        assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
        assert.strictEqual(result.data.statusCode, 200, 'Expected statusCode to be 200');
        assert(result.data.body && typeof result.data.body === 'object', 'Expected result.data.body to be an object');
        assert(typeof result.data.body.formId === 'string', 'Expected body.formId to be a string');
        assert.strictEqual(result.data.body.info.title, formTitle, 'Expected body.info.title to match input');
        assert.strictEqual(result.port, 'out', 'Expected port to be "out"');
    });
});
