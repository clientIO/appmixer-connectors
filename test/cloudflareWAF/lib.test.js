const assert = require('assert');
const lib = require('../../src/appmixer/cloudflareWAF/waf/lib');

describe('CloudFlare WAF', function() {

    it('parseIps', async function() {
        let ips = lib.parseIPs('["1.1.1.1", "2.2.2.2"]');
        assert.deepEqual(ips, ['1.1.1.1', '2.2.2.2']);

        ips = lib.parseIPs(['3.3.3.3']);
        assert.deepEqual(ips, ['3.3.3.3']);

        ips = lib.parseIPs('4.4.4.4,  5.5.5.5');
        assert.deepEqual(ips, ['4.4.4.4', '5.5.5.5']);

        ips = lib.parseIPs('4.4.4.4\n5.5.5.5');
        assert.deepEqual(ips, ['4.4.4.4', '5.5.5.5']);
    });
});
