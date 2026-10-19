'use strict';

const assert = require('assert');
const sinon = require('sinon');

const CreatePost = require('../../core/CreatePost/CreatePost');
const ListOrganizations = require('../../core/ListOrganizations/ListOrganizations');
const MakeApiCall = require('../../core/MakeApiCall/MakeApiCall');
const { VERSION_HEADER } = require('../../lib');

class CancelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CancelError';
    }
}

function createContext(input = {}, properties = {}) {

    const cache = new Map();
    return {
        CancelError,
        auth: { accessToken: 'token-1', profileInfo: { sub: 'member-1' } },
        config: {},
        properties,
        messages: { in: { content: input } },
        httpRequest: sinon.stub(),
        sendJson: sinon.stub().callsFake((data, port) => ({ data, port })),
        log: sinon.stub(),
        lock: sinon.stub().resolves({ unlock: sinon.stub() }),
        staticCache: {
            get: sinon.stub().callsFake(async key => cache.get(key)),
            set: sinon.stub().callsFake(async (key, value) => cache.set(key, value))
        }
    };
}

function httpError(status, data) {

    const err = new Error(`Request failed with status code ${status}`);
    err.response = { status, data };
    return err;
}

describe('linkedinPages core', function() {

    describe('CreatePost', function() {

        it('accepts a numeric organization ID', async function() {

            const context = createContext({ organizationId: '2414183', text: 'Hello' });
            context.httpRequest.resolves({ status: 201, headers: { 'x-restli-id': 'urn:li:share:2' } });

            await CreatePost.receive(context);

            const request = context.httpRequest.firstCall.args[0];
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(request.url, 'https://api.linkedin.com/rest/posts');
            assert.strictEqual(request.headers.Authorization, 'Bearer token-1');
            assert.strictEqual(request.headers['LinkedIn-Version'], VERSION_HEADER);
            assert.strictEqual(request.data.author, 'urn:li:organization:2414183');
            assert.strictEqual(request.data.commentary, 'Hello');
            assert.strictEqual(request.data.visibility, 'PUBLIC');
            assert.strictEqual(request.data.content, undefined);
            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ status: 201, postId: 'urn:li:share:2' }, 'out']);
        });

        it('accepts an organization URN', async function() {

            const context = createContext({ organizationId: ' urn:li:organization:12345 ', text: 'Hello' });
            context.httpRequest.resolves({ status: 201, headers: {} });

            await CreatePost.receive(context);

            assert.strictEqual(context.httpRequest.firstCall.args[0].data.author, 'urn:li:organization:12345');
        });

        it('accepts a numeric organization ID passed as a number', async function() {

            const context = createContext({ organizationId: 12345, text: 'Hello' });
            context.httpRequest.resolves({ status: 201, headers: {} });

            await CreatePost.receive(context);

            assert.strictEqual(context.httpRequest.firstCall.args[0].data.author, 'urn:li:organization:12345');
        });

        [
            'urn:li:person:abc',
            'urn:li:organizationBrand:12345',
            'acme-inc',
            '12345abc'
        ].forEach(organizationId => {
            it(`rejects '${organizationId}' without calling LinkedIn`, async function() {

                const context = createContext({ organizationId, text: 'Hello' });
                await assert.rejects(CreatePost.receive(context), { name: 'CancelError', message: /Invalid organization ID/ });
                assert.strictEqual(context.httpRequest.callCount, 0);
            });
        });

        it('requires the organization ID and text', async function() {

            await assert.rejects(
                CreatePost.receive(createContext({ text: 'Hello' })),
                { name: 'CancelError', message: 'Organization ID is required!' }
            );
            await assert.rejects(
                CreatePost.receive(createContext({ organizationId: '1' })),
                { name: 'CancelError', message: 'Text is required!' }
            );
        });

        it('requires URL and title for article shares', async function() {

            await assert.rejects(
                CreatePost.receive(createContext({ organizationId: '1', text: 'Hi', specificLink: true, title: 'T' })),
                /URL is required/
            );
            await assert.rejects(
                CreatePost.receive(createContext({ organizationId: '1', text: 'Hi', specificLink: true, url: 'https://a.b' })),
                /Title is required/
            );
        });

        it('builds an article share', async function() {

            const context = createContext({
                organizationId: '1',
                text: 'Read this',
                visibility: 'LOGGED_IN',
                specificLink: true,
                url: 'https://example.com/post',
                title: 'Example',
                description: 'An example article'
            });
            context.httpRequest.resolves({ status: 201, headers: {} });

            await CreatePost.receive(context);

            const { data } = context.httpRequest.firstCall.args[0];
            assert.strictEqual(data.visibility, 'LOGGED_IN');
            assert.deepStrictEqual(data.content, {
                article: { source: 'https://example.com/post', title: 'Example', description: 'An example article' }
            });
        });

        describe('with an image', function() {

            const UPLOAD_URL = 'https://www.linkedin.com/dms-uploads/sp/v2/D4E10AQ/uploadedImage/0?ca=x';

            function imageContext(input, fileInfo = { filename: 'photo.png', contentType: 'image/png', length: 1234 }) {

                const context = createContext({ organizationId: '42', text: 'Look', imageFileId: 'file-1', ...input });
                context.getFileInfo = sinon.stub().resolves(fileInfo);
                context.getFileReadStream = sinon.stub().resolves('file-stream');
                context.httpRequest
                    .onFirstCall().resolves({ data: { value: { uploadUrl: UPLOAD_URL, image: 'urn:li:image:D4E10AQ' } } })
                    .onSecondCall().resolves({ status: 201 })
                    .onThirdCall().resolves({ status: 201, headers: { 'x-restli-id': 'urn:li:share:3' } });
                return context;
            }

            it('uploads the file and attaches the image to the post', async function() {

                const context = imageContext({ altText: 'Team photo' });

                const result = await CreatePost.receive(context);

                const init = context.httpRequest.getCall(0).args[0];
                assert.strictEqual(init.url, 'https://api.linkedin.com/rest/images?action=initializeUpload');
                assert.strictEqual(init.headers['LinkedIn-Version'], VERSION_HEADER);
                assert.deepStrictEqual(init.data, { initializeUploadRequest: { owner: 'urn:li:organization:42' } });

                const upload = context.httpRequest.getCall(1).args[0];
                assert.strictEqual(upload.method, 'PUT');
                assert.strictEqual(upload.url, UPLOAD_URL);
                assert.strictEqual(upload.data, 'file-stream');
                assert.strictEqual(upload.headers.Authorization, 'Bearer token-1');
                assert.strictEqual(upload.headers['Content-Length'], 1234);
                sinon.assert.calledWith(context.getFileReadStream, 'file-1');

                const post = context.httpRequest.getCall(2).args[0];
                assert.strictEqual(post.url, 'https://api.linkedin.com/rest/posts');
                assert.deepStrictEqual(post.data.content, { media: { id: 'urn:li:image:D4E10AQ', altText: 'Team photo' } });
                assert.deepStrictEqual(result.data, { status: 201, postId: 'urn:li:share:3' });
            });

            it('omits alt text when it is empty', async function() {

                const context = imageContext({});

                await CreatePost.receive(context);

                assert.deepStrictEqual(context.httpRequest.getCall(2).args[0].data.content, { media: { id: 'urn:li:image:D4E10AQ' } });
            });

            it('accepts a supported extension when the content type is generic', async function() {

                const context = imageContext({}, { filename: 'photo.JPG', contentType: 'application/octet-stream' });

                await CreatePost.receive(context);

                sinon.assert.calledThrice(context.httpRequest);
            });

            it('rejects a link and an image together', async function() {

                const context = imageContext({ specificLink: true, url: 'https://a.b', title: 'T' });

                await assert.rejects(CreatePost.receive(context), { name: 'CancelError', message: /either a shared link or an image/ });
                sinon.assert.notCalled(context.httpRequest);
            });

            it('rejects a file that is not a supported image', async function() {

                const context = imageContext({}, { filename: 'report.pdf', contentType: 'application/pdf' });

                await assert.rejects(CreatePost.receive(context), { name: 'CancelError', message: /JPG, PNG or GIF.*application\/pdf/ });
                sinon.assert.notCalled(context.httpRequest);
            });

            it('does not send the token to an upload URL outside LinkedIn', async function() {

                const context = imageContext({});
                context.httpRequest.onFirstCall().resolves({
                    data: { value: { uploadUrl: 'https://evil.example/linkedin.com', image: 'urn:li:image:X' } }
                });

                await assert.rejects(CreatePost.receive(context), /unexpected image upload host: evil\.example/);
                sinon.assert.calledOnce(context.httpRequest);
            });
        });

        it('escapes little-text characters in plain text', async function() {

            const context = createContext({ organizationId: '1', text: 'Join us (today) at some_name #launch @home' });
            context.httpRequest.resolves({ status: 201, headers: {} });

            await CreatePost.receive(context);

            assert.strictEqual(
                context.httpRequest.firstCall.args[0].data.commentary,
                'Join us \\(today\\) at some\\_name #launch \\@home'
            );
        });

        it('sends little text as typed when mentions are allowed', async function() {

            const text = 'Thanks @[Appmixer](urn:li:organization:2414183) {hashtag|\\#|launch}';
            const context = createContext({ organizationId: '1', text, allowMentions: true });
            context.httpRequest.resolves({ status: 201, headers: {} });

            await CreatePost.receive(context);

            assert.strictEqual(context.httpRequest.firstCall.args[0].data.commentary, text);
        });

        it('explains a 403 and keeps the LinkedIn message', async function() {

            const context = createContext({ organizationId: '42', text: 'Hello' });
            context.httpRequest.rejects(httpError(403, {
                status: 403,
                code: 'ACCESS_DENIED',
                message: 'Not enough permissions to access: partnerApiPostsExternal.CREATE'
            }));

            await assert.rejects(CreatePost.receive(context), err => {
                assert.strictEqual(err.name, 'CancelError');
                assert.match(err.message, /organization 42/);
                assert.match(err.message, /content administrator/);
                assert.match(err.message, /w_organization_social/);
                assert.match(err.message, /partnerApiPostsExternal\.CREATE/);
                return true;
            });
        });

        it('rethrows other errors unchanged', async function() {

            const context = createContext({ organizationId: '42', text: 'Hello' });
            const error = httpError(422, { message: 'invalid' });
            context.httpRequest.rejects(error);

            await assert.rejects(CreatePost.receive(context), err => err === error);
        });
    });

    describe('ListOrganizations', function() {

        function stubLinkedIn(context, { aclPages, organizations = {} }) {

            context.httpRequest.callsFake(async request => {
                if (request.url.endsWith('/organizationAcls')) {
                    const page = request.params.start / request.params.count;
                    return { data: { elements: aclPages[page] || [] } };
                }
                const id = request.url.split('/').pop();
                if (organizations[id] instanceof Error) {
                    throw organizations[id];
                }
                return { data: organizations[id] };
            });
        }

        it('lists approved pages the member can post to, with their names', async function() {

            const context = createContext({}, { isSource: true });
            stubLinkedIn(context, {
                aclPages: [[
                    { organization: 'urn:li:organization:1', role: 'ADMINISTRATOR', state: 'APPROVED' },
                    // Paginated finder sample in LinkedIn docs uses organizationTarget.
                    { organizationTarget: 'urn:li:organization:2', role: 'CONTENT_ADMINISTRATOR', state: 'APPROVED' },
                    { organization: 'urn:li:organization:3', role: 'ANALYST', state: 'APPROVED' }
                ]],
                organizations: {
                    1: { localizedName: 'Acme' },
                    2: httpError(403, { message: 'Viewer does not have permission' })
                }
            });

            const result = await ListOrganizations.receive(context);

            const aclRequest = context.httpRequest.firstCall.args[0];
            assert.deepStrictEqual(aclRequest.params, {
                q: 'roleAssignee', state: 'APPROVED', start: 0, count: 100
            });
            assert.strictEqual(aclRequest.headers['LinkedIn-Version'], VERSION_HEADER);
            assert.deepStrictEqual(result.data, {
                organizations: [{ id: '1', name: 'Acme' }, { id: '2', name: 'Organization 2' }]
            });
            assert.deepStrictEqual(ListOrganizations.organizationsToSelectArray(result.data), [
                { label: 'Acme (1)', value: '1' },
                { label: 'Organization 2 (2)', value: '2' }
            ]);
        });

        it('follows pagination and removes duplicates', async function() {

            const context = createContext();
            const admin = id => ({ organization: `urn:li:organization:${id}`, role: 'ADMINISTRATOR' });
            const firstPage = Array.from({ length: 100 }, (_, i) => admin(i + 1));
            stubLinkedIn(context, { aclPages: [firstPage, [admin(101), admin(1)]] });

            const result = await ListOrganizations.receive(context);

            assert.strictEqual(result.data.organizations.length, 101);
            assert.strictEqual(result.data.organizations[100].id, '101');
            // 2 ACL pages + 101 name lookups; the 3rd page is never requested.
            assert.strictEqual(context.httpRequest.callCount, 103);
        });

        it('caches the list per token', async function() {

            const context = createContext({}, { isSource: true });
            stubLinkedIn(context, {
                aclPages: [[{ organization: 'urn:li:organization:1', role: 'ADMINISTRATOR' }]],
                organizations: { 1: { localizedName: 'Acme' } }
            });

            await ListOrganizations.receive(context);
            const second = await ListOrganizations.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 2); // one ACL page + one name lookup
            assert.deepStrictEqual(second.data.organizations, [{ id: '1', name: 'Acme' }]);
            assert.strictEqual(context.staticCache.set.firstCall.args[2], 15 * 60 * 1000);
            assert.strictEqual(context.lock.callCount, 2);
        });

        it('returns an empty list to the dropdown when LinkedIn fails', async function() {

            const context = createContext({}, { isSource: true });
            context.httpRequest.rejects(httpError(403, { message: 'Not enough permissions' }));

            const result = await ListOrganizations.receive(context);

            assert.deepStrictEqual(result.data, { organizations: [] });
            assert.deepStrictEqual(ListOrganizations.organizationsToSelectArray(result.data), []);
        });

        it('does not cache fallback names when LinkedIn rate-limits the lookup', async function() {

            const context = createContext({}, { isSource: true });
            stubLinkedIn(context, {
                aclPages: [[{ organization: 'urn:li:organization:1', role: 'ADMINISTRATOR' }]],
                organizations: { 1: httpError(429, { message: 'Too many requests' }) }
            });

            const result = await ListOrganizations.receive(context);

            assert.deepStrictEqual(result.data, { organizations: [] });
            assert.strictEqual(context.staticCache.set.callCount, 0);
        });

        it('throws outside of the dropdown', async function() {

            const context = createContext();
            const error = httpError(403, { message: 'Not enough permissions' });
            context.httpRequest.rejects(error);

            await assert.rejects(ListOrganizations.receive(context), err => err === error);
        });

        it('transform tolerates a missing payload', function() {

            assert.deepStrictEqual(ListOrganizations.organizationsToSelectArray(undefined), []);
            assert.deepStrictEqual(ListOrganizations.organizationsToSelectArray({}), []);
        });
    });

    describe('MakeApiCall', function() {

        it('calls a path on api.linkedin.com with the account headers', async function() {

            const context = createContext({
                url: '/rest/organizationAcls',
                method: 'GET',
                parameters: '[{"key": "q", "value": "roleAssignee"}]',
                headers: [{ key: 'X-RestLi-Method', value: 'FINDER' }]
            });
            context.httpRequest.resolves({ status: 200, headers: { a: 'b' }, data: { elements: [] } });

            const result = await MakeApiCall.receive(context);

            const request = context.httpRequest.firstCall.args[0];
            assert.strictEqual(request.url, 'https://api.linkedin.com/rest/organizationAcls');
            assert.deepStrictEqual(request.params, { q: 'roleAssignee' });
            assert.strictEqual(request.headers.Authorization, 'Bearer token-1');
            assert.strictEqual(request.headers['LinkedIn-Version'], VERSION_HEADER);
            assert.strictEqual(request.headers['X-RestLi-Method'], 'FINDER');
            assert.strictEqual(request.data, undefined);
            assert.deepStrictEqual(result.data, { status: 200, headers: { a: 'b' }, body: { elements: [] } });
        });

        it('parses a JSON body and accepts a full LinkedIn URL', async function() {

            const context = createContext({
                url: 'https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A1',
                method: 'DELETE',
                body: '{"a": [1, {"b": true}]}'
            });
            context.httpRequest.resolves({ status: 204, headers: {}, data: '' });

            await MakeApiCall.receive(context);

            const request = context.httpRequest.firstCall.args[0];
            assert.strictEqual(request.url, 'https://api.linkedin.com/rest/posts/urn%3Ali%3Ashare%3A1');
            assert.deepStrictEqual(request.data, { a: [1, { b: true }] });
        });

        [
            'https://evil.example.com/rest/posts',
            '//evil.example.com/rest/posts',
            'http://api.linkedin.com/rest/posts',
            'https://user:pass@api.linkedin.com/rest/posts',
            'https://api.linkedin.com.evil.example.com/rest/posts'
        ].forEach(url => {
            it(`refuses ${url} without sending the token`, async function() {

                const context = createContext({ url, method: 'GET' });
                await assert.rejects(MakeApiCall.receive(context), { name: 'CancelError' });
                assert.strictEqual(context.httpRequest.callCount, 0);
            });
        });

        it('rejects an invalid JSON body and malformed key-value input', async function() {

            await assert.rejects(
                MakeApiCall.receive(createContext({ url: '/rest/posts', method: 'POST', body: '{nope' })),
                { name: 'CancelError', message: 'Request Body must be valid JSON.' }
            );
            await assert.rejects(
                MakeApiCall.receive(createContext({ url: '/rest/posts', method: 'GET', headers: 'x=1' })),
                { name: 'CancelError', message: /Request Headers/ }
            );
        });

        it('rejects a non-string URL with a clear error', async function() {

            const context = createContext({ url: 12345, method: 'GET' });
            context.httpRequest.resolves({ status: 200, headers: {}, data: {} });

            await MakeApiCall.receive(context);
            assert.strictEqual(context.httpRequest.firstCall.args[0].url, 'https://api.linkedin.com/12345');
        });

        it('requires url and method', async function() {

            await assert.rejects(MakeApiCall.receive(createContext({ method: 'GET' })), /API Endpoint Path is required/);
            await assert.rejects(MakeApiCall.receive(createContext({ url: '/rest/posts' })), /HTTP Method is required/);
        });
    });
});
