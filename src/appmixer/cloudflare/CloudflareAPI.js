module.exports = class CloudflareAPI {

    constructor({ email, apiKey, zoneId }) {
        this.email = email;
        this.zoneId = zoneId;
        this.apiKey = apiKey;
    }

    isApiTokenType() {
        return !this.email;
    }

    getHeaders() {

        if (this.isApiTokenType()) {
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            };
        }

        // Global API Key
        return {
            'Content-Type': 'application/json',
            'X-Auth-Email': this.email,
            'X-Auth-Key': this.apiKey
        };
    }

    verify(context) {

        if (this.isApiTokenType()) {
            const headers = this.getHeaders();
            return context.httpRequest({
                method: 'GET',
                url: 'https://api.cloudflare.com/client/v4/user/tokens/verify',
                headers
            });
        }

        return this.verifyGlobalApiKey(context);
    }

    verifyGlobalApiKey(context) {

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
