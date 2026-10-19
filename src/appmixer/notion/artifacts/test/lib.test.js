'use strict';

const assert = require('assert');
const appmixer = require('../../../../../test/utils');

const lib = require('../../lib');

describe('notion lib', () => {

    let context;

    beforeEach(() => {
        context = appmixer.createMockContext({ auth: { accessToken: 'test-token' } });
    });

    describe('resolveApiUrl', () => {

        it('resolves a relative path against the API base', () => {
            assert.strictEqual(lib.resolveApiUrl(context, '/users/me'), 'https://api.notion.com/v1/users/me');
            assert.strictEqual(lib.resolveApiUrl(context, 'users/me'), 'https://api.notion.com/v1/users/me');
        });

        it('accepts an absolute URL on the Notion API', () => {
            assert.strictEqual(
                lib.resolveApiUrl(context, 'https://api.notion.com/v1/pages/abc?x=1'),
                'https://api.notion.com/v1/pages/abc?x=1'
            );
        });

        it('refuses to send the token anywhere else', () => {
            for (const url of [
                'https://example.com/v1/users/me',
                'http://api.notion.com/v1/users/me',
                '//example.com/v1/users/me',
                'https://api.notion.com.example.com/v1/users/me',
                'https://user:secret@api.notion.com/v1/users/me'
            ]) {
                assert.throws(() => lib.resolveApiUrl(context, url), context.CancelError, url);
            }
        });
    });

    describe('pollDatabaseItems', () => {

        // Notion rounds timestamps down to the minute.
        const item = (id, minute) => ({ id, last_edited_time: `2026-01-15T10:${minute}:00.000Z` });

        const poll = async (items, state) => {
            context.httpRequest.resolves({ data: { results: items } });
            context.state = state;
            return lib.pollDatabaseItems(context, 'db-1', 'last_edited_time');
        };

        it('queries the database newest first by the given timestamp', async () => {
            await poll([], {});

            const request = context.httpRequest.firstCall.args[0];
            assert.strictEqual(request.url, 'https://api.notion.com/v1/databases/db-1/query');
            assert.deepStrictEqual(request.data, {
                sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }]
            });
        });

        it('takes a baseline on the first poll instead of replaying the database', async () => {
            const { emit, state } = await poll([item('b', '30'), item('a', '29')], {});

            assert.deepStrictEqual(emit, []);
            assert.deepStrictEqual(state, {
                initialized: true,
                lastTimestamp: '2026-01-15T10:30:00.000Z',
                known: ['b']
            });
        });

        it('emits another item touched in the same minute as the last emitted one', async () => {
            const state = { initialized: true, lastTimestamp: '2026-01-15T10:30:00.000Z', known: ['a'] };

            const result = await poll([item('b', '30'), item('a', '30')], state);

            assert.deepStrictEqual(result.emit.map(i => i.id), ['b']);
            assert.deepStrictEqual(result.state.known, ['b', 'a']);
        });

        it('emits an item again once its timestamp moves on, oldest first', async () => {
            const state = { initialized: true, lastTimestamp: '2026-01-15T10:30:00.000Z', known: ['a', 'b'] };

            const result = await poll([item('a', '32'), item('c', '31'), item('b', '30')], state);

            assert.deepStrictEqual(result.emit.map(i => i.id), ['c', 'a']);
            assert.deepStrictEqual(result.state, {
                initialized: true,
                lastTimestamp: '2026-01-15T10:32:00.000Z',
                known: ['a']
            });
        });

        it('emits nothing when nothing changed and keeps the state', async () => {
            const state = { initialized: true, lastTimestamp: '2026-01-15T10:30:00.000Z', known: ['a'] };

            const result = await poll([item('a', '30'), item('z', '10')], state);

            assert.deepStrictEqual(result.emit, []);
            assert.deepStrictEqual(result.state, state);
        });

        it('emits the first item ever added to a database that was empty at the baseline', async () => {
            const baseline = await poll([], {});
            assert.deepStrictEqual(baseline.state, { initialized: true, lastTimestamp: null, known: [] });

            const result = await poll([item('a', '30')], baseline.state);

            assert.deepStrictEqual(result.emit.map(i => i.id), ['a']);
        });

        it('never moves the timestamp backwards when the newest item is deleted', async () => {
            const state = { initialized: true, lastTimestamp: '2026-01-15T10:30:00.000Z', known: ['a'] };

            const result = await poll([item('z', '10')], state);

            assert.deepStrictEqual(result.emit, []);
            assert.strictEqual(result.state.lastTimestamp, '2026-01-15T10:30:00.000Z');
        });

        it('continues from the { since } state of UpdatedDatabaseItem before 2.2.0 without a duplicate', async () => {
            const state = { since: '2026-01-15T10:30:00.000Z' };

            const result = await poll([item('c', '31'), item('a', '30'), item('z', '10')], state);

            // `a` set `since` and was already emitted by the old version.
            assert.deepStrictEqual(result.emit.map(i => i.id), ['c']);
        });

        it('continues from the { known } state of NewDatabaseItem before 2.2.0', async () => {
            const created = (id, minute) => ({ id, created_time: `2026-01-15T10:${minute}:00.000Z` });
            context.httpRequest.resolves({
                data: { results: [created('new', '31'), created('seen-2', '30'), created('seen-1', '20')] }
            });
            context.state = { known: ['seen-2', 'seen-1', 'deleted-since'] };

            const result = await lib.pollDatabaseItems(context, 'db-1', 'created_time');

            assert.deepStrictEqual(result.emit.map(i => i.id), ['new']);
            assert.deepStrictEqual(result.state, {
                initialized: true,
                lastTimestamp: '2026-01-15T10:31:00.000Z',
                known: ['new']
            });
        });

        it('does not report an old row as new when it slides into the listed page', async () => {
            // `old` was beyond the first 100 rows until a newer row got deleted.
            const created = (id, minute) => ({ id, created_time: `2026-01-15T10:${minute}:00.000Z` });
            context.httpRequest.resolves({ data: { results: [created('a', '30'), created('old', '05')] } });
            context.state = { initialized: true, lastTimestamp: '2026-01-15T10:30:00.000Z', known: ['a'] };

            const result = await lib.pollDatabaseItems(context, 'db-1', 'created_time');

            assert.deepStrictEqual(result.emit, []);
        });
    });

    describe('formatPropertyValue', () => {

        const format = (type, value) => lib.formatPropertyValue(context, 'Field', { type }, value);

        it('reads a checkbox from a boolean or its text form', () => {
            assert.deepStrictEqual(format('checkbox', true), { checkbox: true });
            assert.deepStrictEqual(format('checkbox', 'true'), { checkbox: true });
            assert.deepStrictEqual(format('checkbox', false), { checkbox: false });
            assert.deepStrictEqual(format('checkbox', 'false'), { checkbox: false });
        });

        it('sets a number, skips an empty one and rejects text', () => {
            assert.deepStrictEqual(format('number', '12.5'), { number: 12.5 });
            assert.deepStrictEqual(format('number', 0), { number: 0 });
            assert.strictEqual(format('number', ''), undefined);
            assert.throws(() => format('number', 'abc'), context.CancelError);
        });

        it('splits file URLs separated by commas', () => {
            assert.deepStrictEqual(format('files', 'https://a.example/one.pdf, https://b.example/two.png'), {
                files: [
                    { name: 'one.pdf', external: { url: 'https://a.example/one.pdf' } },
                    { name: 'two.png', external: { url: 'https://b.example/two.png' } }
                ]
            });
            assert.deepStrictEqual(format('files', ['https://a.example/one.pdf']), {
                files: [{ name: 'one.pdf', external: { url: 'https://a.example/one.pdf' } }]
            });
        });

        it('keeps the simple types as they were', () => {
            assert.deepStrictEqual(format('title', 'Plan'), { title: [{ text: { content: 'Plan' } }] });
            assert.deepStrictEqual(format('select', 'Done'), { select: { name: 'Done' } });
            assert.deepStrictEqual(format('multi_select', ['a', 'b']), { multi_select: [{ name: 'a' }, { name: 'b' }] });
            assert.deepStrictEqual(format('people', 'u1'), { people: [{ id: 'u1' }] });
            assert.deepStrictEqual(format('date', '2026-01-15'), { date: { start: '2026-01-15' } });
            assert.deepStrictEqual(format('email', 'a@b.cz'), { email: 'a@b.cz' });
        });
    });

    describe('toCsv', () => {

        it('quotes values holding a comma, a quote or a line break, and nested objects', () => {
            assert.strictEqual(
                lib.toCsv([{ id: '1', title: 'Plan, "Q1"', parent: { type: 'workspace' }, none: null }]),
                'id,title,parent,none\n1,"Plan, ""Q1""","{""type"":""workspace""}",'
            );
            assert.strictEqual(lib.toCsv([]), '');
        });
    });
});
