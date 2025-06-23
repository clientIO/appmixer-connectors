const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('FindDocuments Component', function() {
    let context;
    let FindDocuments;

    this.timeout(30000);

    before(function() {
        // Load the component
        FindDocuments = require(path.join(__dirname, '../../src/appmixer/googledocs/core/FindDocuments/FindDocuments.js'));

        // Mock context
        context = {
            auth: {
                accessToken: process.env.GOOGLE_DOCS_ACCESS_TOKEN
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

        if (!context.auth.accessToken) {
            throw new Error('GOOGLE_DOCS_ACCESS_TOKEN environment variable is required for tests');
        }
    });

    it('should find documents without search query', async function() {
        context.messages.in.content = {
            outputType: 'array'
        };

        await FindDocuments.receive(context);

        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (!Array.isArray(context.sendJsonData.data.result)) {
            throw new Error('Expected sendJsonData.data.result to be an array');
        }
        if (typeof context.sendJsonData.data.count !== 'number') {
            throw new Error('Expected sendJsonData.data.count to be a number');
        }
        if (context.sendJsonData.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }


        console.log(context.sendJsonData.data);
        // Verify document structure if documents exist
        if (context.sendJsonData.data.result.length > 0) {
            const doc = context.sendJsonData.data.result[0];
            if (!doc.id) {
                throw new Error('Expected document to have id property');
            }
            if (!doc.name) {
                throw new Error('Expected document to have name property');
            }
            if (doc.mimeType !== 'application/vnd.google-apps.document') {
                throw new Error('Expected mimeType to be application/vnd.google-apps.document');
            }
        }
    });

    it('should find documents with search query', async function() {
        context.messages.in.content = {
            query: 'Test',
            outputType: 'array'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        await FindDocuments.receive(context);

        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
            throw new Error('Expected sendJsonData.data to be an object');
        }
        if (!Array.isArray(context.sendJsonData.data.result)) {
            throw new Error('Expected sendJsonData.data.result to be an array');
        }
        if (typeof context.sendJsonData.data.count !== 'number') {
            throw new Error('Expected sendJsonData.data.count to be a number');
        }
    });

    it('should default to array output type when not specified', async function() {
        context.messages.in.content = {};

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        await FindDocuments.receive(context);

        if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
            throw new Error('Expected sendJson to be called');
        }
        if (!Array.isArray(context.sendJsonData.data.result)) {
            throw new Error('Expected sendJsonData.data.result to be an array');
        }
        if (typeof context.sendJsonData.data.count !== 'number') {
            throw new Error('Expected sendJsonData.data.count to be a number');
        }
    });

    it('should handle generateOutputPortOptions request', async function() {
        context.properties = {
            generateOutputPortOptions: true
        };
        context.messages.in.content = {
            outputType: 'array'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        await FindDocuments.receive(context);

        // The component should return output port options in this case
        if (!context.sendJsonData) {
            throw new Error('Expected sendJson to be called for output port options');
        }
    });
});
