module.exports = class CloudflareWAFClient {

    constructor({ email, apiKey, zoneId, token }) {
        this.email = email;
        this.apiKey = apiKey;
        this.zoneId = zoneId;
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

    async verify(context) {

        const headers = this.getHeaders();

        return context.httpRequest({
            method: 'GET',
            url: 'https://api.cloudflare.com/client/v4/user/tokens/verify',
            headers
        });
    }

    async callEndpoint(context, {
        action,
        method = 'GET',
        data,
        params
    }) {

        const headers = this.getHeaders();

        return context.httpRequest({
            method,
            url: `https://api.cloudflare.com/client/v4${action}`,
            headers,
            data,
            params
        });
    }

    async getRules(context, rulesetId) {

        const response = await context.httpRequest({
            method: 'GET',
            url: `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets/${rulesetId}`,
            headers: this.getHeaders()
        });

        return response.data;
    }

    async createRulesetAndBlockRule(context, ips) {

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/rulesets`,
            headers: this.getHeaders(),
            data: {
                kind: 'zone',
                phase: 'http_request_firewall_custom',
                name: 'Http Request Firewall Custom Ruleset',
                description: 'Created by Salt Security\'s Cloudflare Integration. Firewall rules of identified attackers will be added to this ruleset.',
                rules: [this.getBlockRule(1, ips)]
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

    async findIdsForIPs({ context, client, ips = [], account, list }) {

        const result = [];
        for (let ipItem of ips) {

            const { data } = await client.callEndpoint(context, {
                method: 'GET',
                action: `/accounts/${account}/rules/lists/${list}/items`,
                params: {
                    per_page: 1,
                    search: ipItem.ip
                }
            });

            if (data?.result[0] && data?.result.length === 1) {
                result.push({ ...data.result[0] });
            }
        }

        return result;
    };
};
