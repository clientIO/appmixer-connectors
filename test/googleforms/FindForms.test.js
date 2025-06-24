const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

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
        let data;
        context.sendJson = function(output, port) {
            data = output;
        };

        context.messages.in.content = {
            outputType: 'array'
        };

        try {
            await FindForms.receive(context);

            console.log('FindForms result:', JSON.stringify(data, null, 2));

            if (!data || typeof data !== 'object') {
                throw new Error('Expected sendJsonData.data to be an object');
            }
            if (!Array.isArray(data.result)) {
                throw new Error('Expected sendJsonData.data.result to be an array');
            }
            if (typeof data.count !== 'number') {
                throw new Error('Expected sendJsonData.data.count to be a number');
            }

            // Verify the count matches array length
            if (data.count !== data.result.length) {
                throw new Error(`Expected count (${data.count}) to match result array length (${data.result.length})`);
            }

            if (data.result.length > 0) {
                const form = data.result[0];
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
        let data;
        context.sendJson = function(output, port) {
            data = output;
        };

        context.messages.in.content = {};

        try {
            await FindForms.receive(context);

            console.log('FindForms default output type result:', JSON.stringify(context.sendJsonData, null, 2));

            if (!data || typeof data !== 'object') {
                throw new Error('Expected sendJsonData.data to be an object');
            }
            if (!Array.isArray(data.result)) {
                throw new Error('Expected sendJsonData.data.result to be an array');
            }
            if (typeof data.count !== 'number') {
                throw new Error('Expected sendJsonData.data.count to be a number');
            }

            // Verify the count matches array length
            if (data.count !== data.result.length) {
                throw new Error(`Expected count (${data.count}) to match result array length (${data.result.length})`);
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
        let data;
        context.sendJson = function(output, port) {
            data = output;
        };

        context.messages.in.content = {
            searchQuery: 'Test',
            outputType: 'array'
        };

        // Reset sendJsonData for this test
        context.sendJsonData = null;

        try {
            await FindForms.receive(context);

            console.log('FindForms with search query result:', JSON.stringify(context.sendJsonData, null, 2));

            if (!data || typeof data !== 'object') {
                throw new Error('Expected sendJsonData.data to be an object');
            }
            if (!Array.isArray(data.result)) {
                throw new Error('Expected sendJsonData.data.result to be an array');
            }
            if (typeof data.count !== 'number') {
                throw new Error('Expected sendJsonData.data.count to be a number');
            }

            // Verify the count matches array length
            if (data.count !== data.result.length) {
                throw new Error(`Expected count (${data.count}) to match result array length (${data.result.length})`);
            }

            // If results found, verify they match the search query
            if (data.result.length > 0) {
                const form = data.result[0];
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

        // Mock sendJson to capture all calls
        const sendJsonCalls = [];
        context.sendJson = function(data, port) {
            sendJsonCalls.push({ data, port });
            return { data, port };
        };

        try {
            await FindForms.receive(context);

            console.log('FindForms object output type calls count:', sendJsonCalls.length);
            if (sendJsonCalls.length > 0) {
                console.log('First call data keys:', Object.keys(sendJsonCalls[0].data));
            }

            if (sendJsonCalls.length === 0) {
                throw new Error('Expected sendJson to be called at least once');
            }

            // For object output type, each form should be sent individually
            // Let's just check the first few calls to avoid overwhelming output
            const callsToCheck = Math.min(sendJsonCalls.length, 5);
            for (let i = 0; i < callsToCheck; i++) {
                const call = sendJsonCalls[i];
                if (!call.data || typeof call.data !== 'object') {
                    throw new Error(`Expected call ${i} data to be an object`);
                }
                if (typeof call.data.index !== 'number') {
                    throw new Error(`Expected call ${i} data to have index property (number)`);
                }
                if (typeof call.data.count !== 'number') {
                    throw new Error(`Expected call ${i} data to have count property (number)`);
                }
                if (call.port !== 'out') {
                    throw new Error(`Expected call ${i} port to be "out"`);
                }
                // Check that the form data is present (should have form properties)
                if (!call.data.id || !call.data.name || !call.data.mimeType) {
                    throw new Error(`Expected call ${i} data to have form properties (id, name, mimeType)`);
                }
            }
            console.log(`All ${callsToCheck} checked calls have correct structure.`);
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
        let data;
        context.sendJson = function(output, port) {
            data = output;
        };

        context.messages.in.content = {
            outputType: 'first'
        };

        try {
            await FindForms.receive(context);

            console.log('FindForms first output type result:', JSON.stringify(context.sendJsonData, null, 2));

            if (!data || typeof data !== 'object') {
                throw new Error('Expected sendJsonData.data to be an object');
            }
            if (typeof data.index !== 'number') {
                throw new Error('Expected sendJsonData.data.index to be a number');
            }
            if (typeof data.count !== 'number') {
                throw new Error('Expected sendJsonData.data.count to be a number');
            }
            if (data.index !== 0) {
                throw new Error('Expected first item to have index 0');
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
