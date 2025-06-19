const assert = require('assert');
const testUtils = require('../utils.js');
const findFormsComponent = require('../../src/appmixer/googleforms/core/FindForms/FindForms');
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

    it('Find Forms - array', async () => {

        let out;
        context.sendJson = (data) => (out = data);
        context.messages = { in: { content: { outputType: 'array' } } };

        await findFormsComponent.receive(context);

        assert.ok(Array.isArray(out.result), 'Output should be an array');
    });

    it('Find Forms - first', async () => {

        let out;
        context.sendJson = (data) => (out = data);
        context.messages = { in: { content: { outputType: 'first' } } };

        await findFormsComponent.receive(context);

        assert.ok(out.id, 'Result should be an object with id');
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

