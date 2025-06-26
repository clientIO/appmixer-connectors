const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('DeleteForm Component', function() {
    let context;
    let DeleteForm;
    let CreateForm;
    let testFormId;

    this.timeout(60000);

    before(async function() {
        // Skip all tests if the access token is not set
        if (!process.env.GOOGLE_FORMS_ACCESS_TOKEN) {
            console.log('Skipping tests - GOOGLE_FORMS_ACCESS_TOKEN not set');
            this.skip();
        }

        // Load the components
        DeleteForm = require(path.join(__dirname, '../../src/appmixer/googleForms/core/DeleteForm/DeleteForm.js'));
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

        assert(testFormId, 'No test form ID available');

        context.messages.in.content = {
            formId: testFormId
        };

        const result = await DeleteForm.receive(context);

        assert(result && typeof result === 'object', 'Expected result to be an object');
        assert(result.data && typeof result.data === 'object', 'Expected result.data to be an object');
        assert.strictEqual(result.port, 'out', 'Expected port to be "out"');
    });
});
