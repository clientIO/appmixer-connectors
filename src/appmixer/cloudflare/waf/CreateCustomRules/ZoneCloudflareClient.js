const { Address4, Address6 } = require('ip-address');

const CloudflareZonesUrlBuilder = require('./CloudflareZonesUrlBuilder');

module.exports = class ZoneCloudflareClient {
    ruleDescription = 'Salt detected high severity attacker';
    ruleRefPrefix = 'SALT';

    constructor(email, apiKey, zoneId, token) {
        this.email = email;
        this.apiKey = apiKey;
        this.zoneId = zoneId;
        this.email = email;
        this.apiKey = apiKey;
        this.token = token;
    }

    getHeaders() {
        if (this.token) {
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            };
        }

        return {
            'Content-Type': 'application/json',
            'X-Auth-Email': this.email,
            'X-Auth-Key': this.apiKey
        };
    }

    getRuleDescription(attackerId) {
        return `${this.ruleDescription} ${attackerId}`;
    }

    getRuleRef(attackerId) {
        return `${this.ruleRefPrefix}-${attackerId}`;
    }

    removeInterfaceIdentifierAndAddCidr(ip) {
        const networkPrefix = String(ip)
            .split(':')
            .slice(0, 4)
            .join(':');
        return `${networkPrefix}::/64`;
    }

    getBlockExpression(ips) {
        const ipv4 = ips.filter(ip => Address4.isValid(ip));
        const ipv6 = ips.filter(ip => Address6.isValid(ip));
        const formattedIpv6 =
            ipv6.length > 0
                ? ipv6.map(ip => this.removeInterfaceIdentifierAndAddCidr(ip))
                : ipv6;
        const allIps = [...ipv4, ...formattedIpv6].sort();

        if (ipv4.length == 1 && formattedIpv6.length == 0)
            return `ip.src eq ${ipv4[0]}`; // To be backward compatible with the current integration behavior
        return `ip.src in {${allIps.join(' ')}}`;
    }

    getBlockRule(attackerId, ips) {
        return {
            action: 'block',
            description: this.getRuleDescription(attackerId),
            enabled: true,
            expression: this.getBlockExpression(ips),
            ref: this.getRuleRef(attackerId)
        };
    }

    listZoneRulesetsForZoneId(context) {
        const headers = this.getHeaders();
        console.log(headers);
        return context.httpRequest({
            method: 'GET',
            url: `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets`,
            headers
        }).then(resp => resp.data.result);
    }

    async getRuleset(context, rulesetId) {
        const url = new CloudflareZonesUrlBuilder(this.zoneId)
            .addRulesets()
            .addRulesetId(rulesetId)
            .getUrl();
        const headers = this.getHeaders();

        const resp = await context.httpRequest.get(url, { headers });

        if (!this.isCloudflareGetRulesetResponse(resp.data)) {
            throw new Error('Invalid CloudflareGetRulesetResponse');
        }

        return resp.data;
    }

    createRulesetAndBlockRule(context, attackerId, ips) {
        const url = new CloudflareZonesUrlBuilder(this.zoneId)
            .addRulesets()
            .getUrl();
        const headers = this.getHeaders();
        const body = {
            kind: 'zone',
            name: 'Http Request Firewall Custom Ruleset',
            description:
                'Created by Salt Security\'s Cloudflare Integration. ' +
                'Firewall rules of identified attackers will be added to this ruleset.',
            phase: 'http_request_firewall_custom',
            rules: [this.getBlockRule(attackerId, ips)]
        };
        return context.httpRequest.post(url, body, { headers }).then(resp => resp.data);
    }

    createBlockRule(context, { rulesetId, attackerId, ips }) {
        const url = new CloudflareZonesUrlBuilder(this.zoneId)
            .addRulesets()
            .addRulesetId(rulesetId)
            .addRules()
            .getUrl();
        const headers = this.getHeaders();
        const body = this.getBlockRule(attackerId, ips);
        return context.httpRequest.post(url, body, { headers }).then(resp => resp.data);
    }

    updateBlockRule(context, rulesetId, ruleId, attackerId, ips) {
        const url = new CloudflareZonesUrlBuilder(this.zoneId)
            .addRulesets()
            .addRulesetId(rulesetId)
            .addRules()
            .addRuleId(ruleId)
            .getUrl();
        const headers = this.getHeaders();
        const body = this.getBlockRule(attackerId, ips);
        return context.httpRequest.patch(url, body, { headers }).then(resp => resp.data);
    }

    isCloudflareGetRulesetResponse(data) {
        return (
            data &&
            typeof data === 'object' &&
            Array.isArray(data.errors) &&
            Array.isArray(data.messages) &&
            data.result &&
            typeof data.result === 'object' &&
            typeof data.result.description === 'string' &&
            typeof data.result.id === 'string' &&
            typeof data.result.kind === 'string' &&
            typeof data.result.last_updated === 'string' &&
            typeof data.result.name === 'string' &&
            typeof data.result.phase === 'string' &&
            typeof data.result.version === 'string' &&
            Array.isArray(data.result.rules)
        );
    }
};
