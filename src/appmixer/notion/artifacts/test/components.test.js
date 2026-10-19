'use strict';

const assert = require('assert');
const appmixer = require('../../../../../test/utils');

const MakeApiCall = require('../../core/MakeApiCall/MakeApiCall');
const UpdateDatabaseItem = require('../../core/UpdateDatabaseItem/UpdateDatabaseItem');
const FindDatabaseItem = require('../../core/FindDatabaseItem/FindDatabaseItem');
const FindPageByTitle = require('../../core/FindPageByTitle/FindPageByTitle');
const UpdatedDatabaseItem = require('../../core/UpdatedDatabaseItem/UpdatedDatabaseItem');
const ListDatabases = require('../../core/ListDatabases/ListDatabases');
const ListDatabaseItems = require('../../core/ListDatabaseItems/ListDatabaseItems');
const ListUsers = require('../../core/ListUsers/ListUsers');

const DATABASE = {
    id: 'db-1',
    properties: {
        Name: { id: 'title', type: 'title', title: {} },
        Email: { id: 'e', type: 'email', email: {} }
    }
};

describe('notion components', () => {

    let context;
    // Requests by "METHOD path" of the Notion API.
    let requests;

    const respond = (routes) => {
        context.httpRequest.callsFake(async (request) => {
            const key = `${request.method} ${request.url.replace('https://api.notion.com/v1', '')}`;
            requests.push({ key, data: request.data });
            if (!(key in routes)) {
                throw new Error(`Unexpected request: ${key}`);
            }
            if (routes[key] instanceof Error) {
                throw routes[key];
            }
            return { status: 200, headers: {}, data: routes[key] };
        });
    };

    beforeEach(() => {
        requests = [];
        context = appmixer.createMockContext({
            auth: { accessToken: 'test-token' },
            messages: { in: { content: {} } }
        });
    });

    describe('MakeApiCall', () => {

        it('calls the Notion API for a relative path', async () => {
            context.messages.in.content = { url: '/users/me', method: 'GET' };
            respond({ 'GET /users/me': { object: 'user' } });

            await MakeApiCall.receive(context);

            assert.strictEqual(context.httpRequest.firstCall.args[0].url, 'https://api.notion.com/v1/users/me');
            assert.deepStrictEqual(context.sendJson.firstCall.args[0].body, { object: 'user' });
        });

        it('does not send the token to another host', async () => {
            context.messages.in.content = { url: 'https://example.com/collect', method: 'POST', body: '{}' };

            await assert.rejects(() => MakeApiCall.receive(context), context.CancelError);
            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('requires the endpoint', async () => {
            context.messages.in.content = { method: 'GET' };

            await assert.rejects(() => MakeApiCall.receive(context), /API Endpoint URL is required/);
        });
    });

    describe('UpdateDatabaseItem', () => {

        beforeEach(() => {
            context.properties = { databaseId: 'db-1' };
            context.messages.in.content = { itemId: 'page-1', Name: 'New name', content: 'New text' };
        });

        it('updates a heading with a heading body, not a paragraph one', async () => {
            respond({
                'GET /databases/db-1': DATABASE,
                'PATCH /pages/page-1': { id: 'page-1' },
                'GET /blocks/page-1/children': { results: [{ id: 'blk-1', type: 'heading_2' }] },
                'PATCH /blocks/blk-1': {}
            });

            await UpdateDatabaseItem.receive(context);

            const blockPatch = requests.find(r => r.key === 'PATCH /blocks/blk-1');
            assert.deepStrictEqual(blockPatch.data, {
                heading_2: { rich_text: [{ type: 'text', text: { content: 'New text' } }] }
            });
            assert.deepStrictEqual(context.sendJson.firstCall.args[0], { id: 'page-1' });
        });

        it('adds a paragraph to a page without a text block instead of dropping the content', async () => {
            respond({
                'GET /databases/db-1': DATABASE,
                'PATCH /pages/page-1': { id: 'page-1' },
                'GET /blocks/page-1/children': { results: [{ id: 'img', type: 'image' }] },
                'PATCH /blocks/page-1/children': {}
            });

            await UpdateDatabaseItem.receive(context);

            const append = requests.find(r => r.key === 'PATCH /blocks/page-1/children');
            assert.strictEqual(append.data.children[0].type, 'paragraph');
            assert.strictEqual(append.data.children[0].paragraph.rich_text[0].text.content, 'New text');
        });

        it('sends only the properties that were provided', async () => {
            context.messages.in.content = { itemId: 'page-1', Email: 'a@b.cz' };
            respond({ 'GET /databases/db-1': DATABASE, 'PATCH /pages/page-1': { id: 'page-1' } });

            await UpdateDatabaseItem.receive(context);

            assert.deepStrictEqual(requests.find(r => r.key === 'PATCH /pages/page-1').data, {
                properties: { Email: { email: 'a@b.cz' } }
            });
        });

        it('requires the item', async () => {
            context.messages.in.content = { Name: 'New name' };

            await assert.rejects(() => UpdateDatabaseItem.receive(context), /Item ID is required/);
            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('offers the item as a typeahead, so an ID can be typed or mapped', async () => {
            context.properties = { databaseId: 'db-1', generateInspector: true };
            respond({ 'GET /databases/db-1': DATABASE });

            await UpdateDatabaseItem.receive(context);

            const { inputs } = context.sendJson.firstCall.args[0];
            assert.strictEqual(inputs.itemId.type, 'text');
            assert.ok(inputs.itemId.source);
            assert.deepStrictEqual(Object.keys(inputs).sort(), ['Email', 'Name', 'content', 'itemId']);
        });

        it('reads the schema for the inspector once per cache window', async () => {
            context.properties = { databaseId: 'db-1', generateInspector: true };
            respond({ 'GET /databases/db-1': DATABASE });

            await UpdateDatabaseItem.receive(context);
            await UpdateDatabaseItem.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 1);
        });
    });

    describe('FindDatabaseItem', () => {

        beforeEach(() => {
            context.properties = { databaseId: 'db-1' };
        });

        it('stops with a clear error when the filtered property no longer exists', async () => {
            context.messages.in.content = { 'Old column': 'x' };
            respond({ 'GET /databases/db-1': DATABASE });

            await assert.rejects(
                () => FindDatabaseItem.receive(context),
                (err) => err instanceof context.CancelError && /"Old column" does not exist/.test(err.message)
            );
            // The search must not run with the filter silently dropped.
            assert.deepStrictEqual(requests.map(r => r.key), ['GET /databases/db-1']);
        });

        it('filters by the property type and returns the most recently edited match', async () => {
            context.messages.in.content = { Email: 'a@b.cz' };
            respond({
                'GET /databases/db-1': DATABASE,
                'POST /databases/db-1/query': { results: [{ id: 'page-2' }, { id: 'page-1' }] }
            });

            await FindDatabaseItem.receive(context);

            assert.deepStrictEqual(requests[1].data.filter, {
                and: [{ property: 'Email', email: { contains: 'a@b.cz' } }]
            });
            assert.deepStrictEqual(context.sendJson.firstCall.args, [{ id: 'page-2' }, 'out']);
        });
    });

    describe('FindPageByTitle', () => {

        it('requires a title — an empty query would return every page', async () => {
            context.messages.in.content = { outputType: 'first' };

            await assert.rejects(() => FindPageByTitle.receive(context), /Title is required/);
            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('joins all fragments of a title', async () => {
            context.messages.in.content = { title: 'Road', outputType: 'first' };
            respond({
                'POST /search': {
                    results: [{
                        id: 'page-1',
                        properties: {
                            Name: {
                                type: 'title',
                                title: [{ type: 'mention', plain_text: '@Ann ' }, { type: 'text', plain_text: 'Roadmap' }]
                            }
                        }
                    }]
                }
            });

            await FindPageByTitle.receive(context);

            assert.deepStrictEqual(context.sendJson.firstCall.args[0].page, { id: 'page-1', title: '@Ann Roadmap' });
        });
    });

    describe('UpdatedDatabaseItem', () => {

        const item = (id, minute) => ({ id, last_edited_time: `2026-01-15T10:${minute}:00.000Z` });

        it('emits an item edited in the same minute as the previously emitted one', async () => {
            context.properties = { databaseId: 'db-1' };
            context.state = { initialized: true, lastTimestamp: '2026-01-15T10:30:00.000Z', known: ['a'] };
            respond({ 'POST /databases/db-1/query': { results: [item('b', '30'), item('a', '30')] } });

            await UpdatedDatabaseItem.tick(context);

            assert.deepStrictEqual(context.sendJson.args.map(args => args[0].id), ['b']);
            assert.deepStrictEqual(context.saveState.firstCall.args[0], {
                initialized: true,
                lastTimestamp: '2026-01-15T10:30:00.000Z',
                known: ['b', 'a']
            });
        });
    });

    describe('private dropdown sources', () => {

        it('ListDatabases is cached and renders an empty dropdown on failure', async () => {
            respond({ 'POST /search': { results: [{ id: 'db-1', title: [{ plain_text: 'Docs' }] }] } });

            await ListDatabases.receive(context);
            await ListDatabases.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 1);
            assert.deepStrictEqual(ListDatabases.databaseToSelectArray(context.sendJson.secondCall.args[0]), [
                { label: 'Docs', value: 'db-1' }
            ]);

            context.auth = { accessToken: 'revoked' };
            respond({ 'POST /search': new Error('Request failed with status code 401') });
            await ListDatabases.receive(context);

            assert.deepStrictEqual(context.sendJson.thirdCall.args[0], { databases: [] });
        });

        it('ListDatabaseItems returns an empty list without a database instead of failing', async () => {
            context.messages = {};

            await ListDatabaseItems.receive(context);

            assert.deepStrictEqual(context.sendJson.firstCall.args[0], { pages: [] });
            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('ListDatabaseItems caches per database', async () => {
            respond({
                'POST /databases/db-1/query': { results: [] },
                'POST /databases/db-2/query': { results: [] }
            });

            context.messages.in.content = { databaseId: 'db-1' };
            await ListDatabaseItems.receive(context);
            await ListDatabaseItems.receive(context);
            context.messages.in.content = { databaseId: 'db-2' };
            await ListDatabaseItems.receive(context);

            assert.deepStrictEqual(requests.map(r => r.key), ['POST /databases/db-1/query', 'POST /databases/db-2/query']);
        });

        it('ListUsers labels a person without a readable email by name', async () => {
            respond({
                'GET /users': {
                    results: [
                        { id: 'u1', type: 'person', name: 'Ann', person: { email: 'ann@example.com' } },
                        { id: 'u2', type: 'person', name: 'Bob', person: {} },
                        { id: 'b1', type: 'bot', name: 'Bot' }
                    ]
                }
            });

            await ListUsers.receive(context);

            assert.deepStrictEqual(ListUsers.usersToSelectArray(context.sendJson.firstCall.args[0]), [
                { value: 'u1', label: 'ann@example.com' },
                { value: 'u2', label: 'Bob' }
            ]);
        });
    });
});
