'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const moment = require('moment');
const sinon = require('sinon');

const auth = require('../../auth');

class InvalidTokenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidTokenError';
    }
}

function authContext({ refreshToken, response } = {}) {

    const context = {
        InvalidTokenError,
        clientId: 'client-1',
        clientSecret: 'secret-1',
        httpRequest: sinon.stub().resolves({ data: response })
    };
    // Mirror the engine: reading a missing refresh token throws.
    Object.defineProperty(context, 'refreshToken', {
        get: () => {
            if (refreshToken === undefined) {
                throw new Error('Refresh token not set.');
            }
            return refreshToken;
        }
    });
    return context;
}

describe('linkedinPages auth', function() {

    const { definition } = auth;

    it('requests only r_basicprofile as the base scope', function() {

        assert.deepStrictEqual(definition.scope, ['r_basicprofile']);
        assert.strictEqual(definition.requestProfileInfo.url, 'https://api.linkedin.com/v2/me');
    });

    it('names the account after the member', function() {

        const name = profileInfo => definition.accountNameFromProfileInfo({ profileInfo });
        assert.strictEqual(name({ localizedFirstName: 'Ada', localizedLastName: 'Lovelace', id: 'x' }), 'Ada Lovelace');
        assert.strictEqual(name({ localizedFirstName: 'Ada', id: 'x' }), 'Ada');
        assert.strictEqual(name({ vanityName: 'ada', id: 'x' }), 'ada');
        assert.strictEqual(name({ id: 'x' }), 'x');
    });

    it('asks for reconnection when LinkedIn issued no refresh token', async function() {

        const context = authContext();
        await assert.rejects(definition.refreshAccessToken(context), { name: 'InvalidTokenError' });
        assert.strictEqual(context.httpRequest.callCount, 0);
    });

    it('refreshes the token and keeps the refresh token when none is returned', async function() {

        const clock = sinon.useFakeTimers(new Date('2026-09-16T12:00:00Z'));
        try {
            const context = authContext({
                refreshToken: 'refresh-1',
                response: { access_token: 'access-2', expires_in: 5184000 }
            });

            const token = await definition.refreshAccessToken(context);

            const request = context.httpRequest.firstCall.args[0];
            assert.strictEqual(request.url, 'https://www.linkedin.com/oauth/v2/accessToken');
            assert.strictEqual(request.headers['Content-Type'], 'application/x-www-form-urlencoded');
            assert.deepStrictEqual(Object.fromEntries(new URLSearchParams(request.data)), {
                grant_type: 'refresh_token',
                refresh_token: 'refresh-1',
                client_id: 'client-1',
                client_secret: 'secret-1'
            });
            assert.deepStrictEqual(token, {
                accessToken: 'access-2',
                accessTokenExpDate: new Date('2026-11-15T12:00:00Z'),
                refreshToken: 'refresh-1'
            });
        } finally {
            clock.restore();
        }
    });

    it('asks for reconnection when LinkedIn refuses the refresh token', async function() {

        const context = authContext({ refreshToken: 'refresh-1' });
        const err = new Error('Request failed with status code 400');
        err.response = { status: 400, data: { error: 'invalid_grant', error_description: 'expired' } };
        context.httpRequest.rejects(err);

        await assert.rejects(definition.refreshAccessToken(context), error => {
            assert.strictEqual(error.name, 'InvalidTokenError');
            assert.match(error.message, /expired/);
            return true;
        });
    });

    it('rethrows other refresh failures', async function() {

        const context = authContext({ refreshToken: 'refresh-1' });
        const err = new Error('Request failed with status code 503');
        err.response = { status: 503, data: {} };
        context.httpRequest.rejects(err);

        await assert.rejects(definition.refreshAccessToken(context), error => error === err);
    });

    it('stores a new refresh token when LinkedIn returns one', async function() {

        const context = authContext({
            refreshToken: 'refresh-1',
            response: { access_token: 'access-2', expires_in: 60, refresh_token: 'refresh-2' }
        });

        const token = await definition.refreshAccessToken(context);
        assert.strictEqual(token.refreshToken, 'refresh-2');
    });
});

describe('linkedinPages quota', function() {

    // Load quota.js the way the engine's quota ManagerLoader does.
    function loadQuota() {

        const source = fs.readFileSync(path.join(__dirname, '../../quota.js'), 'utf8');
        const sandboxModule = { exports: {} };
        vm.compileFunction(source, ['module', 'exports', 'moment', 'console'])(
            sandboxModule, sandboxModule.exports, moment, console
        );
        return sandboxModule.exports;
    }

    it('defines the shares and requests resources with keyable windows', function() {

        const { rules } = loadQuota();
        assert.deepStrictEqual([...new Set(rules.map(rule => rule.resource))].sort(), ['requests', 'shares']);
        rules.forEach(rule => {
            assert.ok(Number.isFinite(rule.window) && rule.window > 0, `${rule.throttling} rule needs a window`);
            // Same computation as the engine's KeyBuilder.calculateWindowBoundary().
            const windowStart = Math.floor(Date.now() / rule.window) * rule.window;
            assert.doesNotThrow(() => new Date(windowStart).toISOString());
        });
    });
});
