const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

describe('MakeAPICall Component', function() {
    let context;
    let MakeAPICall;
    let testFormId;
    
    this.timeout(30000);
    
    before(async function() {
        // Load the component
        MakeAPICall = require(path.join(__dirname, '../../src/appmixer/googleforms/core/MakeAPICall/MakeAPICall.js'));
        
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
        
        // Get a test form ID for API calls
        try {
            const response = await context.httpRequest({
                method: 'GET',
                url: 'https://www.googleapis.com/drive/v3/files',
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                },
                params: {
                    q: "mimeType='application/vnd.google-apps.form'",
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
        if (!testFormId) {
            this.skip('No test form ID available');
        }
        
        context.messages.in.content = {
            method: 'GET',
            url: `https://forms.googleapis.com/v1/forms/${testFormId}`
        };
        
        const result = await MakeAPICall.receive(context);
        
        if (!result || typeof result !== 'object') {
            throw new Error('Expected result to be an object');
        }
        if (!result.data || typeof result.data !== 'object') {
            throw new Error('Expected result.data to be an object');
        }
        if (result.data.statusCode !== 200) {
            throw new Error('Expected statusCode to be 200');
        }
        if (!result.data.body || typeof result.data.body !== 'object') {
            throw new Error('Expected result.data.body to be an object');
        }
        if (result.data.body.formId !== testFormId) {
            throw new Error('Expected body.formId to match test form ID');
        }
        if (!result.data.headers || typeof result.data.headers !== 'object') {
            throw new Error('Expected result.data.headers to be an object');
        }
        if (!result.data.response || typeof result.data.response !== 'object') {
            throw new Error('Expected result.data.response to be an object');
        }
        if (result.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
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
        
        if (!result || typeof result !== 'object') {
            throw new Error('Expected result to be an object');
        }
        if (!result.data || typeof result.data !== 'object') {
            throw new Error('Expected result.data to be an object');
        }
        if (result.data.statusCode !== 200) {
            throw new Error('Expected statusCode to be 200');
        }
        if (!result.data.body || typeof result.data.body !== 'object') {
            throw new Error('Expected result.data.body to be an object');
        }
        if (typeof result.data.body.formId !== 'string') {
            throw new Error('Expected body.formId to be a string');
        }
        if (result.data.body.info.title !== formTitle) {
            throw new Error('Expected body.info.title to match input');
        }
        if (result.port !== 'out') {
            throw new Error('Expected port to be "out"');
        }
    });
    
    it('should throw error when method is missing', async function() {
        context.messages.in.content = {
            url: 'https://forms.googleapis.com/v1/forms'
        };
        
        try {
            await MakeAPICall.receive(context);
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (error.name !== 'CancelError') {
                throw new Error('Expected CancelError');
            }
            if (!error.message.includes('HTTP method is required')) {
                throw new Error('Expected error message to include "HTTP method is required"');
            }
        }
    });
    
    it('should throw error when URL is missing', async function() {
        context.messages.in.content = {
            method: 'GET'
        };
        
        try {
            await MakeAPICall.receive(context);
            throw new Error('Should have thrown an error');
        } catch (error) {
            if (error.name !== 'CancelError') {
                throw new Error('Expected CancelError');
            }
            if (!error.message.includes('API endpoint URL is required')) {
                throw new Error('Expected error message to include "API endpoint URL is required"');
            }
        }
    });
});