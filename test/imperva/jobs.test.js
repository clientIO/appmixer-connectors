const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const jobs = require('../../src/appmixer/imperva/jobs.js');

describe('imperva-rule-block-ips-delete-job', () => {

    let context = testUtils.createMockContext();
    let handler;
    let BlockIPRuleModel;
    const AUTH = { id: 'test-unit-id', key: 'test-unit-key' };

    beforeEach(async () => {
        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            // Jobs specific stubs
            scheduleJob: sinon.stub()
        };

        config = {
            ruleDeleteJob: {
                schedule: '0 0 * * *',
                lockTTL: 60000
            }
        };

        BlockIPRuleModel = {
            collection: 'block_ip_rules'
        };

        COLLECTION_NAME_BLOCK_IPS = BlockIPRuleModel.collection;

        // Register the jobs the same way Appmixer does.
        await jobs(context);
        handler = context.scheduleJob.getCall(0).args[2];
    });

    it('should find and delete expired IPs', async () => {

        const expiredIPs = [
            { ruleId: '111', ip: '192.168.1.1', auth: { id: AUTH.id + '1', key: AUTH.key + '1' }, siteId: '9000001' },
            { ruleId: '111', ip: '192.168.1.3', auth: { id: AUTH.id + '1', key: AUTH.key + '1' }, siteId: '9000001' },
            { ruleId: '222', ip: '192.168.2.1', auth: { id: AUTH.id + '2', key: AUTH.key + '2' }, siteId: '9000002' }
        ];

        const allIPs = [
            { ruleId: '111', ip: '192.168.1.1', siteId: '9000001' },
            { ruleId: '111', ip: '192.168.1.2', siteId: '9000001' },
            { ruleId: '111', ip: '192.168.1.3', siteId: '9000001' },
            { ruleId: '222', ip: '192.168.2.1', siteId: '9000002' }
        ];

        // Stub the 1st DB call to find all the IPs that have expired.
        context.db.collection().find.onCall(0).returns({
            toArray: sinon.stub().resolves(expiredIPs)
        });
        // Stub the 2nd DB call to find all the IPs.
        context.db.collection().find.onCall(1).returns({
            toArray: sinon.stub().resolves(allIPs)
        });
        // Stub the deleteMany method for 9000001
        context.db.collection().deleteMany.resolves({ deletedCount: 2 });
        // Stub the deleteMany method for 9000002
        context.db.collection().deleteMany.resolves({ deletedCount: 1 });

        await handler();

        assert(context.db.collection().find.calledWith({ removeAfter: { $lt: sinon.match.number } }));
        assert.equal(context.db.collection().find.callCount, 2);
        // 2 calls to deleteMany for 9000001 and 9000002
        assert.equal(context.db.collection().deleteMany.callCount, 2);
        assert.deepEqual(context.db.collection().deleteMany.getCall(0).args[0], {
            ip: { $in: ['192.168.1.1', '192.168.1.3'] },
            siteId: '9000001'
        });
        assert.deepEqual(context.db.collection().deleteMany.getCall(1).args[0], {
            ip: { $in: ['192.168.2.1'] },
            siteId: '9000002'
        });
        assert(context.log.calledWith('trace', '[imperva-rule-block-ips-delete-job] rule delete job started.'));
        assert(context.log.calledWith('trace', '[imperva-rule-block-ips-delete-job] rule delete job finished. Lock unlocked.'));

        // Assert Imperva API calls
        assert.equal(context.httpRequest.callCount, 2);
        const httpRequest1Args = context.httpRequest.getCall(0).args[0];
        assert.match(httpRequest1Args.url, /v2\/sites\/\d+\/rules\/\d+$/);
        assert.equal(httpRequest1Args.method, 'PUT');
        assert.equal(httpRequest1Args.headers['x-API-Key'], AUTH.key + '1');
        assert.match(httpRequest1Args.data.name, /Custom IP Block Rule \d+/);
        assert.equal(httpRequest1Args.data.action, 'RULE_ACTION_BLOCK');
        assert.equal(httpRequest1Args.data.filter, 'ClientIP == 192.168.1.2');
        // Assert 2nd update call.
        const httpRequest2Args = context.httpRequest.getCall(1).args[0];
        assert.match(httpRequest2Args.url, /v2\/sites\/\d+\/rules\/\d+$/);
        assert.equal(httpRequest2Args.method, 'DELETE');
        assert.equal(httpRequest2Args.headers['x-API-Key'], AUTH.key + '2');
    });

});
