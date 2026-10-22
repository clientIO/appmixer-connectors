'use strict';

const assert = require('assert');
const sinon = require('sinon');

const CreatePost = require('../../shares/CreatePost/CreatePost');

class CancelError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CancelError';
    }
}

function createContext(input = {}) {

    return {
        CancelError,
        auth: { accessToken: 'token-1', profileInfo: { sub: 'member-1' } },
        messages: { in: { content: input } },
        httpRequest: sinon.stub(),
        sendJson: sinon.stub()
    };
}

describe('linkedin CreatePost', function() {

    it('uses an active LinkedIn API version', function() {

        const { VERSION_HEADER } = require('../../constants');
        assert.strictEqual(VERSION_HEADER, '202608');
    });

    it('requires text', async function() {

        const context = createContext({ visibility: 'PUBLIC' });
        await assert.rejects(CreatePost.receive(context), { name: 'CancelError', message: 'Text is required!' });
        assert.strictEqual(context.httpRequest.callCount, 0);
    });

    it('requires URL and title when sharing a link', async function() {

        const noUrl = createContext({ text: 'Hello', specificLink: true, title: 'T' });
        await assert.rejects(CreatePost.receive(noUrl), { name: 'CancelError', message: /URL is required/ });

        const noTitle = createContext({ text: 'Hello', specificLink: true, url: 'https://example.com' });
        await assert.rejects(CreatePost.receive(noTitle), { name: 'CancelError', message: /Title is required/ });

        assert.strictEqual(noUrl.httpRequest.callCount + noTitle.httpRequest.callCount, 0);
    });

    it('posts plain text as the member', async function() {

        const context = createContext({ text: 'Hello', visibility: 'CONNECTIONS' });
        context.httpRequest.resolves({ status: 201, headers: { 'x-restli-id': 'urn:li:share:1' } });

        await CreatePost.receive(context);

        const request = context.httpRequest.firstCall.args[0];
        assert.strictEqual(request.method, 'POST');
        assert.strictEqual(request.url, 'https://api.linkedin.com/rest/posts');
        assert.strictEqual(request.headers['LinkedIn-Version'], '202608');
        assert.strictEqual(request.headers.Authorization, 'Bearer token-1');
        assert.strictEqual(request.data.author, 'urn:li:person:member-1');
        assert.strictEqual(request.data.commentary, 'Hello');
        assert.strictEqual(request.data.visibility, 'CONNECTIONS');
        assert.strictEqual(request.data.content, undefined);
        assert.deepStrictEqual(context.sendJson.firstCall.args, [{ status: 201, postId: 'urn:li:share:1' }, 'out']);
    });

    it('posts an article share', async function() {

        const context = createContext({
            text: 'Read this',
            specificLink: true,
            url: 'https://example.com/post',
            title: 'Example',
            description: 'An example article'
        });
        context.httpRequest.resolves({ status: 201, headers: {} });

        await CreatePost.receive(context);

        assert.strictEqual(context.httpRequest.firstCall.args[0].data.visibility, 'PUBLIC');
        assert.deepStrictEqual(context.httpRequest.firstCall.args[0].data.content, {
            article: { source: 'https://example.com/post', title: 'Example', description: 'An example article' }
        });
    });
});
