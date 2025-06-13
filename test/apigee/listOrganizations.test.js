const assert = require('assert');
const dotenv = require('dotenv');
const axios = require('axios');

const component = require('../../src/appmixer/apigee/core/ListOrganizations/ListOrganizations');
const { createMockContext } = require('../utils');

dotenv.config({ path: __dirname + '../../.env' });

describe('Apigee - listOrganizations', () => {

    let context;

    beforeEach(async function() {

        context = {
            ...createMockContext({
                auth: {
                    accessToken: process.env.APIGEE_ACCESS_TOKEN
                },
                httpRequest: axios
            })

        };
    });

    it('should handle parameters.ADD with empty object', async () => {

        let result;
        context.sendJson = (data, key) => {
            result = data;
        };
        await component.receive(context);

        console.log(result);
        assert.ok(Array.isArray(result.organizations));
        assert.ok(result.organizations[0].name !== undefined);
        assert.ok(result.organizations[0].projectId !== undefined);
    });
});
