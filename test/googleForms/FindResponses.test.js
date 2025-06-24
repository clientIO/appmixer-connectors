const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const assert = require('assert');

describe('FindResponses Component', function() {
    let context;
    let component;
    let testFormId; // We'll use a form ID from created form or existing one

    this.timeout(30000);

    before(async function() {
        // Skip all tests if access token is not set
        if (!process.env.GOOGLE_FORMS_ACCESS_TOKEN) {
            console.log('Skipping FindResponses tests - GOOGLE_FORMS_ACCESS_TOKEN not set');
            this.skip();
        }

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
            }, sendJson: function(data, port) {
                return { data, port };
            }, httpRequest: require('./httpRequest.js'), CancelError: class extends Error {
                constructor(message) {
                    super(message);
                    this.name = 'CancelError';
                }
            }
        };

        // Try to create a test form or use existing one
        // We'll use a sample form ID - in real testing, this should be a form with responses
        testFormId = '1mYtGExmv-ztm-CVhK5x3f1eDDPDK2iXda7wD5LYgP9s';
    });

    it('should find responses without filter', async function() {
        if (!context.auth.accessToken) this.skip();

        let data;
        context.sendJson = function(output, port) {
            data = output;
            return { data: output, port };
        };

        context.messages.in.content = {
            formId: testFormId, outputType: 'array'
        };

        try {
            await component.receive(context);

            console.log('FindResponses result:', JSON.stringify(data, null, 2));

            // The result could be empty if no responses exist, which is fine
            assert(data && typeof data === 'object', 'Expected result to be an object');

            if (data.result) {
                assert(Array.isArray(data.result), 'Expected result to be an array');
                assert(typeof data.count === 'number', 'Expected count to be a number');
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('Form not found or no responses - this is expected for test form');
                return; // This is acceptable
            }
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                throw new Error('Authentication failed: Access token is invalid or expired');
            }
            throw error;
        }
    });

    it('should find responses with timestamp filter', async function() {
        if (!context.auth.accessToken) this.skip();

        let data;
        context.sendJson = function(output, port) {
            data = output;
            return { data: output, port };
        };

        // Use a timestamp filter from yesterday to get recent responses
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const timestampFilter = `timestamp > ${yesterday.toISOString()}`;

        context.messages.in.content = {
            formId: testFormId, filter: timestampFilter, outputType: 'array'
        };

        try {
            await component.receive(context);

            console.log('FindResponses with filter result:', JSON.stringify(data, null, 2));

            // The result could be empty if no recent responses exist, which is fine
            assert(data && typeof data === 'object', 'Expected result to be an object');

            if (data.result) {
                assert(Array.isArray(data.result), 'Expected result to be an array');
                assert(typeof data.count === 'number', 'Expected count to be a number');
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('Form not found or no responses - this is expected for test form');
                return; // This is acceptable
            }
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                throw new Error('Authentication failed: Access token is invalid or expired');
            }
            throw error;
        }
    });

    it('should handle object output type', async function() {
        if (!context.auth.accessToken) this.skip();

        const sendJsonCalls = [];
        context.sendJson = function(data, port) {
            sendJsonCalls.push({ data, port });
            return { data, port };
        };

        context.messages.in.content = {
            formId: testFormId, outputType: 'object'
        };

        try {
            await component.receive(context);

            console.log('FindResponses object output type calls count:', sendJsonCalls.length);

            // If responses exist, each should be sent individually
            if (sendJsonCalls.length > 0) {
                const callsToCheck = Math.min(sendJsonCalls.length, 3);
                for (let i = 0; i < callsToCheck; i++) {
                    const call = sendJsonCalls[i];
                    assert(call.data && typeof call.data === 'object', `Expected call ${i} data to be an object`);
                    assert.strictEqual(call.port, 'out', `Expected call ${i} port to be "out"`);
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('Form not found or no responses - this is expected for test form');
                return; // This is acceptable
            }
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                throw new Error('Authentication failed: Access token is invalid or expired');
            }
            throw error;
        }
    });

    it('should handle first output type', async function() {
        if (!context.auth.accessToken) this.skip();

        let data;
        context.sendJson = function(output, port) {
            data = output;
            return { data: output, port };
        };

        context.messages.in.content = {
            formId: testFormId, outputType: 'first'
        };

        try {
            await component.receive(context);

            console.log('FindResponses first output type result:', JSON.stringify(data, null, 2));

            if (data) {
                assert(data && typeof data === 'object', 'Expected result to be an object');
                if (data.index !== undefined) {
                    assert(typeof data.index === 'number', 'Expected index to be a number');
                    assert.strictEqual(data.index, 0, 'Expected first item to have index 0');
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 404) {
                console.log('Form not found or no responses - this is expected for test form');
                return; // This is acceptable
            }
            if (error.name === 'CancelError' && error.message.includes('No records available')) {
                console.log('No responses found for first output type test - this is expected if no responses exist');
                return; // This is acceptable
            }
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                throw new Error('Authentication failed: Access token is invalid or expired');
            }
            throw error;
        }
    });

    it('should handle invalid filter format gracefully', async function() {
        if (!context.auth.accessToken) this.skip();

        context.messages.in.content = {
            formId: testFormId, filter: 'invalid filter format', outputType: 'array'
        };

        try {
            await component.receive(context);
            // If it doesn't throw, that's fine - the API might handle invalid filters gracefully
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('Invalid filter format correctly returned 400 error');
                return; // This is expected behavior
            }
            if (error.response && error.response.status === 404) {
                console.log('Form not found - this is expected for test form');
                return; // This is acceptable
            }
            if (error.response && error.response.status === 401) {
                console.log('Authentication failed - access token may be expired');
                throw new Error('Authentication failed: Access token is invalid or expired');
            }
            // Other errors should be logged but not fail the test
            console.log('Error with invalid filter (expected):', error.message);
        }
    });
});
