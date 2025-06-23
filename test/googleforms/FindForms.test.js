const assert = require('assert');
const testUtils = require('../utils.js');
const findFormsComponent = require('../../src/appmixer/googleforms/core/FindForms/FindForms');
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
});

