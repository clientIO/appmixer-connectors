'use strict';

const assert = require('assert');

const auth = require('../../auth');
const getUsage = require('../../core/GetUsage/GetUsage');
const makeApiCall = require('../../core/MakeApiCall/MakeApiCall');
const renderPage = require('../../core/RenderPage/RenderPage');

class CancelError extends Error {}

function contextFor(content, httpRequest) {

    const output = {};
    return {
        output,
        auth: { apiKey: 'test-api-key-material' },
        messages: { in: { content } },
        httpRequest,
        CancelError,
        saveFileStream: async (filename, bytes) => {
            output.saved = { filename, bytes };
            return { fileId: 'file_123' };
        },
        sendJson: (data, port) => {
            output.data = data;
            output.port = port;
            return { data, port };
        }
    };
}

describe('Latchshot connector', function() {

    it('validates API keys without exposing them in profile information', async function() {

        let request;
        const context = {
            apiKey: 'test-api-key-secret-material',
            httpRequest: async (value) => {
                request = value;
                return { data: {} };
            }
        };

        assert.strictEqual(await auth.definition.validate(context), true);
        assert.strictEqual(request.url, 'https://latchshot.fly.dev/v1/usage');
        assert.strictEqual(request.headers.Authorization, 'Bearer test-api-key-secret-material');

        const profile = await auth.definition.requestProfileInfo(context);
        assert(!profile.key.includes('secret_material'));
        assert.strictEqual(profile.key, 'test-api...rial');
    });

    it('renders exact REST options and saves direct PNG bytes as an Appmixer file', async function() {

        let request;
        const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const context = contextFor({
            url: 'https://example.com',
            format: 'png',
            width: 1280,
            height: 720,
            scale: 2,
            fullPage: true,
            waitUntil: 'networkidle',
            delay: 500,
            timeout: 20000,
            darkMode: true,
            reducedMotion: true,
            blockAds: true,
            blockTrackers: true,
            blockChats: true,
            hideCookieBanners: true,
            hidePopups: true
        }, async (value) => {
            request = value;
            return {
                data: bytes,
                headers: {
                    'content-type': 'image/png',
                    'content-length': String(bytes.length),
                    'x-latchshot-render-ms': '412',
                    'x-quota-remaining': '98'
                }
            };
        });

        await renderPage.receive(context);

        assert.deepStrictEqual(request.data, {
            url: 'https://example.com',
            kind: 'screenshot',
            format: 'png',
            width: 1280,
            height: 720,
            scale: 2,
            waitUntil: 'networkidle',
            delay: 500,
            timeout: 20000,
            darkMode: true,
            reducedMotion: true,
            blockAds: true,
            blockTrackers: true,
            blockChats: true,
            hideCookieBanners: true,
            hidePopups: true,
            fullPage: true
        });
        assert.strictEqual(request.headers.Authorization, 'Bearer test-api-key-material');
        assert.strictEqual(request.responseType, 'arraybuffer');
        assert.match(context.output.saved.filename, /^latchshot-\d+\.png$/);
        assert.deepStrictEqual(context.output.saved.bytes, bytes);
        assert.deepStrictEqual(context.output.data, {
            fileId: 'file_123',
            filename: context.output.saved.filename,
            contentType: 'image/png',
            fileSize: 4,
            renderMs: 412,
            quotaRemaining: 98
        });
    });

    it('selects PDF rendering explicitly and rejects the wrong response type', async function() {

        let request;
        const context = contextFor({ url: 'https://example.com', format: 'pdf', paper: 'Letter', landscape: true }, async (value) => {
            request = value;
            return { data: Buffer.from('not a pdf'), headers: { 'content-type': 'image/png' } };
        });

        await assert.rejects(() => renderPage.receive(context), /instead of application\/pdf/);
        assert.strictEqual(request.data.kind, 'pdf');
        assert.strictEqual(request.data.format, 'pdf');
        assert.strictEqual(request.data.paper, 'Letter');
        assert.strictEqual(request.data.landscape, true);
        assert(!Object.hasOwn(request.data, 'quality'));
        assert(!Object.hasOwn(request.data, 'fullPage'));
    });

    it('rejects missing URLs and artifacts declared above 15 MB', async function() {

        const missing = contextFor({}, async () => assert.fail('request should not run'));
        await assert.rejects(() => renderPage.receive(missing), /Public Page URL is required/);

        const oversized = contextFor({ url: 'https://example.com' }, async () => ({
            data: Buffer.from([1]),
            headers: {
                'content-type': 'image/png',
                'content-length': String(15 * 1024 * 1024 + 1)
            }
        }));
        await assert.rejects(() => renderPage.receive(oversized), /exceeded the 15 MB/);
    });

    it('returns flattened read-only usage and owner-managed continuation links', async function() {

        const context = contextFor({}, async () => ({
            data: {
                usage: {
                    plan: 'trial',
                    period: '2026-07',
                    limit: 100,
                    successful: 1,
                    failed: 0,
                    remaining: 99,
                    resetAt: '2026-08-01T00:00:00.000Z'
                },
                links: {
                    plans: 'https://latchshot.fly.dev/#pricing',
                    requestPaidPlan: 'https://latchshot.fly.dev/#upgrade',
                    implementationPilot: 'https://latchshot.fly.dev/implementation-pilot.html'
                }
            }
        }));

        await getUsage.receive(context);
        assert.deepStrictEqual(context.output.data, {
            plan: 'trial',
            planName: 'Free',
            period: '2026-07',
            limit: 100,
            successful: 1,
            failed: 0,
            remaining: 99,
            resetAt: '2026-08-01T00:00:00.000Z',
            plansUrl: 'https://latchshot.fly.dev/#pricing',
            requestPaidPlanUrl: 'https://latchshot.fly.dev/#upgrade',
            implementationPilotUrl: 'https://latchshot.fly.dev/implementation-pilot.html'
        });
    });

    it('keeps generic API calls on the fixed origin and protects authorization', async function() {

        let request;
        const context = contextFor({
            url: '/v1/usage',
            method: 'GET',
            parameters: [{ key: 'detail', value: 'summary' }],
            headers: [
                { key: 'Authorization', value: 'Bearer attacker' },
                { key: 'X-Trace', value: 'test' }
            ]
        }, async (value) => {
            request = value;
            return {
                status: 200,
                headers: { 'content-type': 'application/json' },
                data: { ok: true }
            };
        });

        await makeApiCall.receive(context);
        assert.strictEqual(request.url, 'https://latchshot.fly.dev/v1/usage');
        assert.strictEqual(request.headers.Authorization, 'Bearer test-api-key-material');
        assert.strictEqual(request.headers['X-Trace'], 'test');
        assert.deepStrictEqual(request.params, { detail: 'summary' });

        const offOrigin = contextFor({ url: 'https://example.com/v1/usage', method: 'GET' }, async () => assert.fail('request should not run'));
        await assert.rejects(() => makeApiCall.receive(offOrigin), /must use https:\/\/latchshot\.fly\.dev/);
    });

    it('rejects invalid JSON bodies and binary generic responses', async function() {

        const invalidBody = contextFor({ url: '/v1/usage', method: 'POST', body: '{' }, async () => assert.fail('request should not run'));
        await assert.rejects(() => makeApiCall.receive(invalidBody), /must be valid JSON/);

        const binary = contextFor({ url: '/v1/render', method: 'POST', body: '{}' }, async () => ({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: Buffer.from([1])
        }));
        await assert.rejects(() => makeApiCall.receive(binary), /Use Render Page/);
    });
});
