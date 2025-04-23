const lib = require('../../src/appmixer/cloudflareWAF/waf/lib');
const jobLibs = require('../../src/appmixer/cloudflareWAF/jobs.waf');
const assert = require('assert');

describe('Cloudflare', () => {

    describe('remove ips from rule', () => {

        it('remove 2 ips', async () => {

            const rule = {
                id: '123',
                name: 'test rule',
                expression: '(ip.src in {123.0.2.0 123.0.2.1 123.0.2.2})'
            };

            const ipsToRemove = ['123.0.2.0', '123.0.2.1'];

            const updatedRule = jobLibs.removeIpsFromRule(rule, ipsToRemove);

            assert.equal(updatedRule.expression, '(ip.src in {123.0.2.2})', '2 ips has been removed.');
            assert.equal(updatedRule.id, '123');
        });
    });

    describe('prepare rules', () => {

        it('create or update rules', async () => {

            const rules = [{
                id: '123',
                expression: '(ip.src in {123.0.2.0 123.0.2.1 123.0.2.2})'
            }, {
                id: '222',
                expression: '(ip.src in {222.0.0.0})'
            }];

            const ips = ['111.0.2.1', '111.0.2.2', '111.0.2.3'];

            let rulesToUpdateOrCreate;
            rulesToUpdateOrCreate = lib.prepareRulesForCreateOrUpdate(ips, rules, 1000);
            assert.equal(rulesToUpdateOrCreate.length, 1);
            assert.equal(rulesToUpdateOrCreate[0].id, '123', 'new ips should fit in the id:123 rule');
            assert.ok(rulesToUpdateOrCreate[0].expression.includes('111.0.2.3'));

            rulesToUpdateOrCreate = lib.prepareRulesForCreateOrUpdate(ips, rules, 40);
            assert.equal(rulesToUpdateOrCreate.length, 2, 'it should update id:222 and create a new one');
            assert.equal(rulesToUpdateOrCreate[0].id, '222', 'new ips should fit in the id:222 rule');
            assert.ok(rulesToUpdateOrCreate[0].expression.includes('111.0.2.1'));

            assert.equal(rulesToUpdateOrCreate[1].id, undefined, 'new rule is created');
            assert.ok(rulesToUpdateOrCreate[1].expression.includes('111.0.2.2'));

        });

    });

    describe('extract ips from existing rules', () => {

        it('parse expression', async () => {

            const ips = lib.extractIPs('(ip.src in {192.0.2.0 192.0.2.2 192.0.2.3})');

            assert.ok(ips.length > 0);
        });

        it('get ips', async () => {

            const ips = lib.getIpsFromRules([{
                id: '123',
                expression: '(ip.src in {192.0.2.0 192.0.2.1 192.0.2.2})'
            }, {
                id: '456',
                expression: '(ip.src in {192.0.2.3 192.0.2.4 192.0.2.5})'
            }]);

            assert.equal(Object.keys(ips).length, 6);
            assert.equal(Object.keys(ips).length, 6);
        });
    });
});
