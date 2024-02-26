'use strict';
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');

const formatToken = token => ({ key: token.slice(12, 53), secret: token.slice(73, 105) });

class Schoology {

    static get MAX_RECORDS_PER_PAGE() {

        return 50;
    }

    constructor(consumerKey, consumerSecret, district, siteBase = 'https://api.schoology.com/v1', options = {}) {

        this.consumerKey = consumerKey;
        this.consumerSecret = consumerSecret;
        this.district = district;
        this.siteBase = siteBase;

        this.requestToken = options.requestToken;
        this.requestTokenSecret = options.requestTokenSecret;

        this.accessToken = options.accessToken;
        this.accessTokenSecret = options.accessTokenSecret;
        this.httpRequest = options.httpRequest;

        this.oauth = OAuth({
            consumer: { key: consumerKey, secret: consumerSecret },
            signature_method: 'HMAC-SHA1',
            hash_function: (baseString, key) => crypto.createHmac('sha1', key).update(baseString).digest('base64')
        });
    }

    setRequestToken(token) {

        this.requestToken = token;
    }

    setRequestTokenSecret(token) {

        this.requestTokenSecret = token;
    }

    setAccessToken(token) {

        this.accessToken = token;
    }

    setAccessTokenSecret(token) {

        this.accessTokenSecret = token;
    }

    async request(method, path, queryParams = {}, body = {}, accessToken = '') {

        const url = new URL(`${this.siteBase + path}`);
        url.search = new URLSearchParams(queryParams);

        const fullUrl = url.toString();
        const headers = this.oauth.toHeader(this.oauth.authorize({
            url: fullUrl,
            method: method
        }, formatToken(accessToken)));

        const response = await this.httpRequest({
            method: method,
            url: fullUrl,
            headers,
            data: body
        });
        return response.data;
    }

    getRequestToken() {

        return this.request('GET', '/oauth/request_token');
    }

    getOAuthURL(callback) {

        return `https://${this.district}.schoology.com/oauth/authorize?oauth_token=${this.requestToken}&oauth_callback=${callback}`;
    }

    getAccessToken() {

        const params = {
            oauth_token: this.requestToken,
            oauth_token_secret: this.requestTokenSecret
        };

        const qs = new URLSearchParams(params);
        const accessToken = qs.toString();

        return this.request('GET', `/oauth/access_token?oauth_verifier=${this.requestToken}`, {}, {}, accessToken);
    }

    async apiRequest(method, path, queryParams = {}, body = {}) {

        const params = {
            oauth_token: this.accessToken,
            oauth_token_secret: this.accessTokenSecret
        };

        const qs = new URLSearchParams(params);
        const accessToken = qs.toString();

        return this.request(method, path, queryParams, body, accessToken);
    }

    getPageLimit(limit) {

        return limit < Schoology.MAX_RECORDS_PER_PAGE ? limit : Schoology.MAX_RECORDS_PER_PAGE;
    }

    getNumberOfPages(limit) {

        return Math.ceil(limit / this.getPageLimit(limit));
    }

    paginatedCall(method, path, limit = 100, assembler, queryParams = {}, data = {}) {

        const pageLimit = this.getPageLimit(limit);
        const nPages = this.getNumberOfPages(limit);

        const callFn = (iterations) => {

            const offset = pageLimit * iterations;
            return this.apiRequest(method, path, {
                ...queryParams,
                start: offset,
                limit: pageLimit
            }, data);
        };

        return this.accumulativeCall(nPages, callFn, assembler);
    }

    async accumulativeCall(times, callFn, assembler) {

        const promises = [];

        for (let i = 0; i < times; i++) {
            const p = callFn(i);
            promises.push(p);
        }

        const data = await Promise.all(promises);

        return assembler(data);
    }
}

module.exports = Schoology;

module.exports.createClientFromContext = (context) => {

    const { consumerKey, consumerSecret, accessToken, accessTokenSecret } = context.auth;
    const { domain, baseUrl } = context.config;

    return new Schoology(consumerKey, consumerSecret, domain, baseUrl, {
        accessToken,
        accessTokenSecret,
        httpRequest: context.httpRequest
    });
};
