'use strict';

const assert = require('assert');
const sinon = require('sinon');
const appmixer = require('../../../../../test/utils');

const ListPages = require('../../core/ListPages/ListPages');

// Shapes as returned by POST /v1/search (Notion-Version 2022-06-28).
const SEARCH_RESULTS = [
    {
        object: 'page',
        id: 'b8c9d0e1-f2a3-4567-bcde-678901234567',
        created_time: '2025-12-01T08:00:00.000Z',
        last_edited_time: '2026-01-15T10:30:00.000Z',
        parent: { type: 'workspace', workspace: true },
        archived: false,
        properties: {
            title: { id: 'title', type: 'title', title: [{ type: 'text', plain_text: 'Launch plan' }] }
        },
        url: 'https://app.notion.com/p/Launch-plan-b8c9d0e1f2a34567bcde678901234567',
        public_url: null
    },
    {
        // A database item: the title property carries the column's name, and the
        // title is split into several rich-text fragments.
        object: 'page',
        id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
        created_time: '2025-11-20T09:00:00.000Z',
        last_edited_time: '2025-12-24T12:00:00.000Z',
        parent: { type: 'database_id', database_id: '9b4c8f2e-1d3a-4e5b-8c7d-6f0a1b2c3d4e' },
        archived: false,
        properties: {
            Status: { id: 'abc', type: 'select', select: { name: 'Done' } },
            Name: {
                id: 'title',
                type: 'title',
                title: [{ type: 'text', plain_text: 'Q1 ' }, { type: 'mention', plain_text: 'Roadmap' }]
            }
        },
        url: 'https://app.notion.com/p/Q1-Roadmap-e5f6a7b8c9d01234efab345678901234',
        public_url: null
    },
    {
        object: 'page',
        id: '7a1d2c3b-4e5f-4a6b-9c8d-0e1f2a3b4c5d',
        created_time: '2025-10-01T09:00:00.000Z',
        last_edited_time: '2025-10-02T12:00:00.000Z',
        parent: { type: 'page_id', page_id: 'b8c9d0e1-f2a3-4567-bcde-678901234567' },
        archived: false,
        properties: { title: { id: 'title', type: 'title', title: [] } },
        url: 'https://app.notion.com/p/7a1d2c3b4e5f4a6b9c8d0e1f2a3b4c5d',
        public_url: null
    }
];

// A database as returned by POST /v1/search with the `database` filter.
const DATABASES = [
    {
        object: 'database',
        id: '9b4c8f2e-1d3a-4e5b-8c7d-6f0a1b2c3d4e',
        title: [{ type: 'text', plain_text: 'Roadmaps' }],
        parent: { type: 'workspace', workspace: true }
    }
];

describe('notion ListPages', () => {

    let context;

    beforeEach(() => {
        context = appmixer.createMockContext({
            auth: { accessToken: 'test-token' },
            messages: { in: { content: {} } }
        });
        context.httpRequest.resolves({ data: { results: SEARCH_RESULTS, has_more: false } });
    });

    it('searches pages only, most recently edited first, at the maximum page size', async () => {
        context.messages.in.content = { outputType: 'array' };

        await ListPages.receive(context);

        const request = context.httpRequest.firstCall.args[0];
        assert.strictEqual(request.method, 'POST');
        assert.strictEqual(request.url, 'https://api.notion.com/v1/search');
        assert.deepStrictEqual(request.data, {
            filter: { value: 'page', property: 'object' },
            sort: { direction: 'descending', timestamp: 'last_edited_time' },
            page_size: 100
        });
    });

    it('array: sends { result, count } and reads the title from the property of type title', async () => {
        context.messages.in.content = { outputType: 'array' };

        await ListPages.receive(context);

        const [output, port] = context.sendJson.firstCall.args;
        assert.strictEqual(port, 'out');
        assert.strictEqual(output.count, 3);
        assert.deepStrictEqual(output.result.map(page => page.title), ['Launch plan', 'Q1 Roadmap', 'Untitled']);
        assert.deepStrictEqual(output.result[1], {
            id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
            title: 'Q1 Roadmap',
            url: 'https://app.notion.com/p/Q1-Roadmap-e5f6a7b8c9d01234efab345678901234',
            public_url: null,
            created_time: '2025-11-20T09:00:00.000Z',
            last_edited_time: '2025-12-24T12:00:00.000Z',
            parent: { type: 'database_id', database_id: '9b4c8f2e-1d3a-4e5b-8c7d-6f0a1b2c3d4e' }
        });
    });

    it('emits only fields declared in ITEM_SCHEMA, and every required one', async () => {
        context.messages.in.content = { outputType: 'array' };

        await ListPages.receive(context);

        const declared = Object.keys(ListPages.ITEM_SCHEMA.properties);
        for (const page of context.sendJson.firstCall.args[0].result) {
            assert.deepStrictEqual(Object.keys(page).filter(key => !declared.includes(key)), []);
            for (const key of ListPages.ITEM_SCHEMA.required) {
                assert.notStrictEqual(page[key], undefined, `${key} missing`);
            }
        }
    });

    it('defaults to the array mode when outputType is not set', async () => {
        await ListPages.receive(context);

        assert.strictEqual(context.sendJson.firstCall.args[0].result.length, 3);
    });

    it('first: sends the first page with index and count', async () => {
        context.messages.in.content = { outputType: 'first' };

        await ListPages.receive(context);

        assert.strictEqual(context.sendJson.callCount, 1);
        const [output] = context.sendJson.firstCall.args;
        assert.strictEqual(output.id, 'b8c9d0e1-f2a3-4567-bcde-678901234567');
        assert.strictEqual(output.index, 0);
        assert.strictEqual(output.count, 3);
    });

    it('object: sends one message per page', async () => {
        context.messages.in.content = { outputType: 'object' };

        await ListPages.receive(context);

        assert.strictEqual(context.sendJson.callCount, 3);
        assert.strictEqual(context.sendJson.thirdCall.args[0].index, 2);
    });

    it('file: writes an empty CSV instead of crashing when there are no pages', async () => {
        context.messages.in.content = { outputType: 'file' };
        context.httpRequest.resolves({ data: { results: [] } });
        context.saveFileStream = sinon.stub().resolves({ fileId: 'file-1' });

        await ListPages.receive(context);

        assert.strictEqual(context.saveFileStream.firstCall.args[1].toString(), '');
        assert.deepStrictEqual(context.sendJson.firstCall.args[0], { fileId: 'file-1' });
    });

    it('file: every row has as many cells as the header, with nested and comma values quoted', async () => {
        context.messages.in.content = { outputType: 'file' };
        const tricky = {
            ...SEARCH_RESULTS[0],
            properties: {
                title: { id: 'title', type: 'title', title: [{ type: 'text', plain_text: 'Plan, "Q1"\nfinal' }] }
            }
        };
        context.httpRequest.resolves({ data: { results: [tricky] } });
        context.saveFileStream = sinon.stub().resolves({ fileId: 'file-1' });

        await ListPages.receive(context);

        const csv = context.saveFileStream.firstCall.args[1].toString();
        assert.strictEqual(csv, [
            'id,title,url,public_url,created_time,last_edited_time,parent',
            'b8c9d0e1-f2a3-4567-bcde-678901234567,"Plan, ""Q1""\nfinal",' +
            'https://app.notion.com/p/Launch-plan-b8c9d0e1f2a34567bcde678901234567,,' +
            '2025-12-01T08:00:00.000Z,2026-01-15T10:30:00.000Z,"{""type"":""workspace"",""workspace"":true}"'
        ].join('\n'));
    });

    it('array: an empty workspace gives an empty result, not an error', async () => {
        context.messages.in.content = { outputType: 'array' };
        context.httpRequest.resolves({ data: { results: [] } });

        await ListPages.receive(context);

        assert.deepStrictEqual(context.sendJson.firstCall.args[0], { result: [], count: 0 });
    });

    it('lets an API error reach the flow', async () => {
        context.messages.in.content = { outputType: 'array' };
        context.httpRequest.rejects(new Error('Request failed with status code 401'));

        await assert.rejects(() => ListPages.receive(context), /401/);
    });

    describe('generateOutputPortOptions', () => {

        beforeEach(() => {
            context.properties = { generateOutputPortOptions: true };
        });

        it('array: one `result` option holding the item schema, without calling the API', async () => {
            context.messages.in.content = { outputType: 'array' };

            await ListPages.receive(context);

            const [options] = context.sendJson.firstCall.args;
            // The picker must offer everything the array mode emits: { result, count }.
            assert.deepStrictEqual(options.map(option => option.value), ['count', 'result']);
            assert.strictEqual(options[1].label, 'Pages');
            assert.deepStrictEqual(options[1].schema.items.properties, ListPages.ITEM_SCHEMA.properties);
            assert.strictEqual(context.httpRequest.callCount, 0);
        });

        it('describes the array mode when outputType is not set, like the data path does', async () => {
            await ListPages.receive(context);

            const [options] = context.sendJson.firstCall.args;
            assert.deepStrictEqual(options.map(option => option.value), ['count', 'result']);
        });

        it('first: one option per field plus index and count', async () => {
            context.messages.in.content = { outputType: 'first' };

            await ListPages.receive(context);

            const values = context.sendJson.firstCall.args[0].map(option => option.value);
            assert.deepStrictEqual(values, [
                'index', 'count', 'id', 'title', 'url', 'public_url', 'created_time', 'last_edited_time', 'parent'
            ]);
        });
    });

    describe('as a dropdown source (isSource)', () => {

        beforeEach(() => {
            context.properties = { isSource: true };
            // The designer sends no message with a source call.
            context.messages = {};
        });

        // The source call searches pages and databases; answer each by its filter.
        const respondWith = ({ pages = SEARCH_RESULTS, databases = DATABASES } = {}) => {
            context.httpRequest.callsFake(async (request) => {
                const results = request.data.filter.value === 'database' ? databases : pages;
                if (results instanceof Error) {
                    throw results;
                }
                return { data: { results } };
            });
        };

        const page = (id, title, parent) => ({
            object: 'page',
            id,
            parent,
            properties: { title: { id: 'title', type: 'title', title: [{ type: 'text', plain_text: title }] } }
        });

        const labels = () => ListPages.pageToSelectArray(context.sendJson.lastCall.args[0]).map(o => o.label);

        beforeEach(() => respondWith());

        it('labels each page with its path and lists a page right before its descendants', async () => {
            await ListPages.receive(context);

            const [output] = context.sendJson.firstCall.args;
            assert.deepStrictEqual(Object.keys(output.result[0]), ['id', 'path']);
            assert.deepStrictEqual(ListPages.pageToSelectArray(output), [
                { label: 'Launch plan', value: 'b8c9d0e1-f2a3-4567-bcde-678901234567' },
                { label: 'Launch plan / Untitled', value: '7a1d2c3b-4e5f-4a6b-9c8d-0e1f2a3b4c5d' },
                { label: 'Roadmaps / Q1 Roadmap', value: 'e5f6a7b8-c9d0-1234-efab-345678901234' }
            ]);
        });

        it('keeps a subpage next to its own parent when siblings share a title', async () => {
            respondWith({
                pages: [
                    page('child-2', 'Notes', { type: 'page_id', page_id: 'project-2' }),
                    page('project-1', 'Project', { type: 'workspace', workspace: true }),
                    page('project-2', 'Project', { type: 'workspace', workspace: true }),
                    page('child-1', 'Notes', { type: 'page_id', page_id: 'project-1' }),
                    page('grandchild', 'Draft', { type: 'page_id', page_id: 'child-1' })
                ],
                databases: []
            });

            await ListPages.receive(context);

            assert.deepStrictEqual(ListPages.pageToSelectArray(context.sendJson.firstCall.args[0]), [
                { label: 'Project', value: 'project-1' },
                { label: 'Project / Notes', value: 'child-1' },
                { label: 'Project / Notes / Draft', value: 'grandchild' },
                { label: 'Project', value: 'project-2' },
                { label: 'Project / Notes', value: 'child-2' }
            ]);
        });

        it('starts the path at the page itself when its parent is not visible', async () => {
            respondWith({
                pages: [
                    page('orphan', 'Shared subpage', { type: 'page_id', page_id: 'not-shared' }),
                    page('in-block', 'Inside a column', { type: 'block_id', block_id: 'some-block' })
                ],
                databases: []
            });

            await ListPages.receive(context);

            assert.deepStrictEqual(labels(), ['Inside a column', 'Shared subpage']);
        });

        it('does not cache labels built without the databases: a failed search is retried', async () => {
            respondWith({ databases: new Error('Request failed with status code 502') });

            await ListPages.receive(context);

            assert.deepStrictEqual(context.sendJson.lastCall.args[0], { result: [] });

            respondWith();
            await ListPages.receive(context);

            assert.deepStrictEqual(labels(), ['Launch plan', 'Launch plan / Untitled', 'Roadmaps / Q1 Roadmap']);
        });

        it('does not drop or loop on pages that are each other\'s parent', async () => {
            respondWith({
                pages: [
                    page('a', 'A', { type: 'page_id', page_id: 'b' }),
                    page('b', 'B', { type: 'page_id', page_id: 'a' })
                ],
                databases: []
            });

            await ListPages.receive(context);

            assert.deepStrictEqual(labels().sort(), ['A', 'A / B'].sort());
        });

        it('serves the second call from the cache and releases the lock', async () => {
            const unlock = sinon.stub();
            context.lock = sinon.stub().resolves({ unlock });

            await ListPages.receive(context);
            await ListPages.receive(context);

            // One page search + one database search, then nothing.
            assert.strictEqual(context.httpRequest.callCount, 2);
            assert.deepStrictEqual(context.sendJson.secondCall.args[0], context.sendJson.firstCall.args[0]);
            assert.strictEqual(unlock.callCount, 2);
        });

        it('does not share the cache between accounts', async () => {
            await ListPages.receive(context);
            context.auth = { accessToken: 'another-token' };
            await ListPages.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 4);
        });

        it('renders an empty dropdown instead of an error when the API call fails', async () => {
            const unlock = sinon.stub();
            context.lock = sinon.stub().resolves({ unlock });
            context.httpRequest.rejects(new Error('Request failed with status code 401'));

            await ListPages.receive(context);

            assert.deepStrictEqual(context.sendJson.firstCall.args[0], { result: [] });
            assert.strictEqual(unlock.callCount, 1);
            assert.deepStrictEqual(ListPages.pageToSelectArray({ result: [] }), []);
        });
    });
});
