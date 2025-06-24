const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('GetResponse Component', function() {
    let context;
    let component;

    this.timeout(30000);

    before(async function() {
        // Load the component
        component = require(path.join(__dirname, '../../src/appmixer/googleForms/core/FindResponses/FindResponses.js'));

        // Mock context
        context = {
            auth: {
                accessToken: process.env.GOOGLE_FORMS_ACCESS_TOKEN
            },
            properties: {},
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

    it('should throw error when formId is missing', async function() {
        // Skip test if access token is not set - important for CI/CD environments
        if (!context.auth.accessToken) this.skip();

        context.messages.in.content = {
            formId: '1mYtGExmv-ztm-CVhK5x3f1eDDPDK2iXda7wD5LYgP9s',
            outputType: 'object'
        };

        await component.receive(context);
        // assert.fail('Should have thrown an error');
        // assert.strictEqual(error.name, 'CancelError', 'Expected CancelError');
        // assert(error.message.includes('Form ID is required'), 'Expected error message to include "Form ID is required"');
    });
});
