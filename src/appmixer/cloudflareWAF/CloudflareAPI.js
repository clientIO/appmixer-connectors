module.exports = class CloudflareAPI {

    constructor({ email, apiKey, zoneId, token }) {
        this.email = email;
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

    async verify(context) {

        const headers = this.getHeaders();

        return context.httpRequest({
            method: 'GET',
            url: 'https://api.cloudflare.com/client/v4/user/tokens/verify',
            headers
        });
    }

    // WAF
    /**
     * https://developers.cloudflare.com/api/operations/getZoneRuleset
     */
    listZoneRulesets(context) {

        return context.httpRequest({
            method: 'GET',
            url: `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets`,
            headers: this.getHeaders()
        }).then(resp => resp.data.result);
    }

    async getRules(context, rulesetId) {

        const response = await context.httpRequest({
            method: 'GET',
            url: `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets/${rulesetId}`,
            headers: this.getHeaders()
        });

        return response.data;
    }

    async createRulesetAndBlockRule(context, rules) {

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets`,
            headers: this.getHeaders(),
            data: {
                kind: 'zone',
                phase: 'http_request_firewall_custom',
                name: 'Http Request Firewall Custom Ruleset',
                description: 'Generated Ruleset.',
                rules
            }
        });

        return data;
    }

    // https://developers.cloudflare.com/api/resources/rulesets/subresources/rules/
    createBlockRule(context, { rulesetId, rule }) {
        const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets/${rulesetId}/rules`;
        const headers = this.getHeaders();
        return context.httpRequest.post(url, rule, { headers }).then(resp => resp.data);
    }

    updateBlockRule(context, rulesetId, rule) {
        const url = `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets/${rulesetId}/rules/${rule.id}`;
        const headers = this.getHeaders();
        return context.httpRequest.patch(url, rule, { headers }).then(resp => resp.data);
    }
};
