const assert = require('assert');
const dotenv = require('dotenv');
const axios = require('axios');

const component = require('../../src/appmixer/apigee/core/ListEnvironments/ListEnvironments');
const { createMockContext } = require('../utils');

dotenv.config({ path: __dirname + '../../.env' });

describe('Apigee - listEnvironments', () => {

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
        context.sendJson = (data) => {
            result = data;
        };
        context.messages = {
            in: {
                content: {
                    org: 'new-edge-team',
                    outputType: 'array'
                }
            }
        };

        await component.receive(context);

        assert.ok(Array.isArray(result));
        assert.ok(typeof result[0] === 'string'); // Assuming environments are returned as an array of strings
    });
});
