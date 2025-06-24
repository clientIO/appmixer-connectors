const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('FindForms Component', function() {
    let context;
    let FindForms;

    this.timeout(30000);

    before(function() {
        // Load the component
        FindForms = require(path.join(__dirname, '../../src/appmixer/googleforms/core/FindForms/FindForms.js'));

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

        if (!context.auth.accessToken) {
            throw new Error('GOOGLE_FORMS_ACCESS_TOKEN environment variable is required for tests');
        }
    });

    it('should find forms without search query', async function() {
        context.messages.in.content = {
            outputType: 'array'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        try {
            await FindForms.receive(context);

            console.log('FindForms result:', JSON.stringify(context.sendJsonData, null, 2));

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

            // Verify the count matches array length
            if (context.sendJsonData.data.count !== context.sendJsonData.data.result.length) {
                throw new Error(`Expected count (${context.sendJsonData.data.count}) to match result array length (${context.sendJsonData.data.result.length})`);
            }

            if (context.sendJsonData.data.result.length > 0) {
                const form = context.sendJsonData.data.result[0];
                if (!form.id) {
                    throw new Error('Expected form to have id property');
                }
                if (!form.name) {
                    throw new Error('Expected form to have name property');
                }
                if (form.mimeType !== 'application/vnd.google-apps.form') {
                    throw new Error(`Expected mimeType to be 'application/vnd.google-apps.form', got: ${form.mimeType}`);
                }

                // Verify required fields are present
                const requiredFields = ['id', 'name', 'mimeType'];
                for (const field of requiredFields) {
                    if (!(field in form)) {
                        throw new Error(`Expected form to have ${field} property`);
                    }
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            throw error;
        }
    });

    it('should default to array output type when not specified', async function() {
        context.messages.in.content = {};

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        try {
            await FindForms.receive(context);

            console.log('FindForms default output type result:', JSON.stringify(context.sendJsonData, null, 2));

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

            // Verify the count matches array length
            if (context.sendJsonData.data.count !== context.sendJsonData.data.result.length) {
                throw new Error(`Expected count (${context.sendJsonData.data.count}) to match result array length (${context.sendJsonData.data.result.length})`);
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            throw error;
        }
    });

    it('should find forms with search query', async function() {
        context.messages.in.content = {
            searchQuery: 'Test',
            outputType: 'array'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        try {
            await FindForms.receive(context);

            console.log('FindForms with search query result:', JSON.stringify(context.sendJsonData, null, 2));

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

            // Verify the count matches array length
            if (context.sendJsonData.data.count !== context.sendJsonData.data.result.length) {
                throw new Error(`Expected count (${context.sendJsonData.data.count}) to match result array length (${context.sendJsonData.data.result.length})`);
            }

            // If results found, verify they match the search query
            if (context.sendJsonData.data.result.length > 0) {
                const form = context.sendJsonData.data.result[0];
                if (!form.name.toLowerCase().includes('test')) {
                    console.log('Warning: Search query "Test" did not filter results as expected');
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            throw error;
        }
    });

    it('should handle object output type', async function() {
        context.messages.in.content = {
            outputType: 'object'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        // Mock sendJson to capture all calls
        const sendJsonCalls = [];
        context.sendJson = function(data, port) {
            sendJsonCalls.push({ data, port });
            return { data, port };
        };

        try {
            await FindForms.receive(context);

            console.log('FindForms object output type calls:', JSON.stringify(sendJsonCalls, null, 2));

            if (sendJsonCalls.length === 0) {
                throw new Error('Expected sendJson to be called at least once');
            }

            // For object output type, each form should be sent individually
            for (const call of sendJsonCalls) {
                if (!call.data || typeof call.data !== 'object') {
                    throw new Error('Expected each call data to be an object');
                }
                if (typeof call.data.index !== 'number') {
                    throw new Error('Expected each call data to have index property');
                }
                if (typeof call.data.count !== 'number') {
                    throw new Error('Expected each call data to have count property');
                }
                if (call.port !== 'out') {
                    throw new Error('Expected port to be "out"');
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            throw error;
        }
    });

    it('should handle first output type', async function() {
        context.messages.in.content = {
            outputType: 'first'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        try {
            await FindForms.receive(context);

            console.log('FindForms first output type result:', JSON.stringify(context.sendJsonData, null, 2));

            if (!context.sendJsonData || typeof context.sendJsonData !== 'object') {
                throw new Error('Expected sendJson to be called');
            }
            if (!context.sendJsonData.data || typeof context.sendJsonData.data !== 'object') {
                throw new Error('Expected sendJsonData.data to be an object');
            }
            if (typeof context.sendJsonData.data.index !== 'number') {
                throw new Error('Expected sendJsonData.data.index to be a number');
            }
            if (typeof context.sendJsonData.data.count !== 'number') {
                throw new Error('Expected sendJsonData.data.count to be a number');
            }
            if (context.sendJsonData.data.index !== 0) {
                throw new Error('Expected first item to have index 0');
            }
            if (context.sendJsonData.port !== 'out') {
                throw new Error('Expected port to be "out"');
            }
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                console.log('Error details:', error.response.data);
                throw new Error('Authentication failed: Access token is invalid or expired. Please refresh the GOOGLE_FORMS_ACCESS_TOKEN in .env file');
            }
            if (error.name === 'CancelError' && error.message.includes('No records available')) {
                console.log('No forms found for first output type test - this is expected if no forms exist');
                return; // This is acceptable
            }
            throw error;
        }
    });
});
