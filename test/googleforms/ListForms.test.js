const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('ListForms Component', function() {
    let context;
    let ListForms;

    this.timeout(30000);

    before(function() {
        // Load the component
        ListForms = require(path.join(__dirname, '../../src/appmixer/googleforms/core/ListForms/ListForms.js'));

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
            properties: {},
            sendJsonData: null,
            sendJson: function(data, port) {
                this.sendJsonData = { data, port };
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

    it('should list forms with array output type', async function() {
        context.messages.in.content = {
            outputType: 'array'
        };

        await ListForms.receive(context);

        assert(context.sendJsonData && typeof context.sendJsonData === 'object', 'Expected sendJson to be called');
        assert(context.sendJsonData.data && typeof context.sendJsonData.data === 'object', 'Expected sendJsonData.data to be an object');
        assert(Array.isArray(context.sendJsonData.data.result), 'Expected sendJsonData.data.result to be an array');
        assert(typeof context.sendJsonData.data.count === 'number', 'Expected sendJsonData.data.count to be a number');
        assert.strictEqual(context.sendJsonData.port, 'out', 'Expected port to be "out"');

        if (context.sendJsonData.data.result.length > 0) {
            const form = context.sendJsonData.data.result[0];
            assert(form.id, 'Expected form to have id property');
            assert(form.name, 'Expected form to have name property');
            assert(form.mimeType, 'Expected form to have mimeType property');
            assert.strictEqual(form.mimeType, 'application/vnd.google-apps.form', 'Expected mimeType to be application/vnd.google-apps.form');
        }
    });

    it('should default to array output type when not specified', async function() {
        context.messages.in.content = {};

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        await ListForms.receive(context);

        assert(context.sendJsonData && typeof context.sendJsonData === 'object', 'Expected sendJson to be called');
        assert(context.sendJsonData.data && typeof context.sendJsonData.data === 'object', 'Expected sendJsonData.data to be an object');
        assert(Array.isArray(context.sendJsonData.data.result), 'Expected sendJsonData.data.result to be an array');
        assert(typeof context.sendJsonData.data.count === 'number', 'Expected sendJsonData.data.count to be a number');
    });
});
