const assert = require('assert');
const testUtils = require('../utils.js');
const createFormComponent = require('../../src/appmixer/googleforms/core/CreateForm/CreateForm');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '../.env') });

describe('Google Forms', () => {

    let context;
    beforeEach(() => {
        context = testUtils.createMockContext();
        context.auth.accessToken = process.env.GOOGLE_FORMS_ACCESS_TOKEN;
        context.httpRequest = axios;
    });

    it('Create Form - basic form creation', async () => {

        let out;
        context.sendJson = (data) => (out = data);
        context.messages = {
            in: {
                content: {
                    title: 'Test Form ' + Date.now(),
                    documentTitle: 'Test Document ' + Date.now()
                }
            }
        };

        await createFormComponent.receive(context);

        // Verify basic properties exist
        assert.ok(out, 'Output should exist');
        assert.ok(out.formId, 'Output should have formId');

        // Verify the title matches what we sent
        assert.strictEqual(out.info.title, context.messages.in.content.title, 'Form title should match input title');
    });
});

