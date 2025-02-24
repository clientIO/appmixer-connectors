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

    async verifyGlobalApiKey(context) {

        const headers = this.getHeaders();

        return context.httpRequest({
            method: 'GET',
            url: 'https://api.cloudflare.com/client/v4/accounts',
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
};
