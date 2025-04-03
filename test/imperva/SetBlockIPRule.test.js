const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const SetBlockIPRule = require('../../src/appmixer/imperva/waf/SetBlockIPRule/SetBlockIPRule.js');

describe('SetBlockIPRule', () => {

    let context = testUtils.createMockContext();

    beforeEach(async () => {

        // Reset the context.
        context = testUtils.createMockContext();
        // Set the profile info.
        context.auth = {
            key: 'test-key',
            id: 'test-id'
        };
        context.messages = { in: { content: { data: null } } };
        context.componentId = 'testComponentId';
    });

    it('one invalid IP', async () => {

        context.messages.in.content = {
            ips: 'invalid-com'
        };

        await assert.rejects(SetBlockIPRule.receive(context), { message: 'Found invalid IPs: invalid-com' });

        // await SetBlockIPRule.receive(context);

        assert.equal(context.sendJson.callCount, 0);
    });

    it('too many IPs', async () => {

        context.messages.in.content = {
            // Construct a string with 1001 IPv6 addresses.
            ips: Array.from({ length: 1001 }, (_, i) => `2001:0db8:85a3:0000:0000:8a2e:0370:${i.toString(16).padStart(4, '0')}`).join(',')
        };

        await assert.rejects(SetBlockIPRule.receive(context), { message: 'Too many IPs provided. Max 1000. You provided 1001.' });
    });

    it('2 valid IPs', async () => {

        context.messages.in.content = {
            ips: '2001:0db8:85a3:0000:0000:8a2e:0370:7334,2001:0db8:85a3:0000:0000:8a2e:0370:7335'
        };

        context.callAppmixer = sinon.stub().returns(Promise.resolve({ processed: ['2001:0db8:85a3:0000:0000:8a2e:0370:7334', '2001:0db8:85a3:0000:0000:8a2e:0370:7335'] }));

        await SetBlockIPRule.receive(context);

        assert.equal(context.callAppmixer.callCount, 1);
        assert.equal(context.callAppmixer.getCall(0).args[0].body.ips.length, 2);
        assert.equal(context.callAppmixer.getCall(0).args[0].body.ips[0], '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        assert.equal(context.callAppmixer.getCall(0).args[0].body.ips[1], '2001:0db8:85a3:0000:0000:8a2e:0370:7335');

        assert.equal(context.sendJson.callCount, 1);
        assert.equal(context.sendJson.getCall(0).args[1], 'out');
        assert.equal(context.sendJson.getCall(0).args[0].processed.length, 2);
        assert.equal(context.sendJson.getCall(0).args[0].processed[0], '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
        assert.equal(context.sendJson.getCall(0).args[0].processed[1], '2001:0db8:85a3:0000:0000:8a2e:0370:7335');
    });
});
