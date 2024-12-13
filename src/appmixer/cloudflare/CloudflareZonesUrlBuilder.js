module.exports = class CloudflareZonesUrlBuilder {
    zonesBaseUrl = 'https://api.cloudflare.com/client/v4/zones';

    constructor(zoneId) {
        this.zoneId = zoneId;
        this.url = `${this.zonesBaseUrl}/${this.zoneId}`;
    }

    addRulesets() {
        this.url += '/rulesets';
        return this;
    }

    addRulesetId(rulesetId) {
        this.url += `/${rulesetId}`;
        return this;
    }

    addRules() {
        this.url += '/rules';
        return this;
    }

    addRuleId(ruleId) {
        this.url += `/${ruleId}`;
        return this;
    }

    getUrl() {
        return this.url;
    }
};
