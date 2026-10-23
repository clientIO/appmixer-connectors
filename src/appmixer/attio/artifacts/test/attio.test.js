'use strict';

const assert = require('assert');
const { Readable } = require('stream');

const lib = require('../../lib');
const CreatePerson = require('../../core/CreatePerson/CreatePerson');
const FindPeople = require('../../core/FindPeople/FindPeople');
const UpdateRecord = require('../../core/UpdateRecord/UpdateRecord');
const UpdatePerson = require('../../core/UpdatePerson/UpdatePerson');
const UploadFile = require('../../core/UploadFile/UploadFile');
const FindListEntries = require('../../core/FindListEntries/FindListEntries');
const MakeApiCall = require('../../core/MakeApiCall/MakeApiCall');
const NewRecord = require('../../core/NewRecord/NewRecord');

class CancelError extends Error {}

/**
 * Minimal Appmixer context: records requests, answers them with `responder`.
 */
function createContext({ input = {}, properties = {}, state = {}, webhook, responder = () => ({}) } = {}) {
    const cache = {};
    const context = {
        auth: { apiKey: 'test-token' },
        config: {},
        componentId: 'component-1',
        properties,
        messages: webhook ? { webhook: { content: webhook } } : { in: { content: input } },
        CancelError,
        requests: [],
        sent: [],
        state: { ...state },
        async httpRequest(options) {
            context.requests.push(options);
            const result = await responder(options);
            return { status: 200, headers: {}, data: result };
        },
        async sendJson(data, port) {
            context.sent.push({ data, port });
        },
        async saveState(newState) {
            context.state = newState;
        },
        async loadState() {
            return context.state;
        },
        async log() {},
        async lock() {
            return { unlock() {} };
        },
        staticCache: {
            async get(key) { return cache[key]; },
            async set(key, value) { cache[key] = value; }
        },
        getWebhookUrl() {
            return 'https://appmixer.example.com/webhook/1';
        },
        response() {
            return 'ack';
        }
    };
    return context;
}

const RECORD = {
    id: { workspace_id: 'ws-1', object_id: 'obj-1', record_id: 'rec-1' },
    created_at: '2026-10-20T08:00:00.000000000Z',
    web_url: 'https://app.attio.com/acme/person/rec-1',
    values: {
        name: [{ active_until: null, attribute_type: 'personal-name', first_name: 'Jane', last_name: 'Doe', full_name: 'Jane Doe' }],
        email_addresses: [
            { active_until: null, attribute_type: 'email-address', email_address: 'jane@acme.com' },
            { active_until: null, attribute_type: 'email-address', email_address: 'jd@acme.com' }
        ],
        stage: [{ active_until: null, attribute_type: 'status', status: { title: 'Lead' } }],
        old: [{ active_until: '2026-01-01T00:00:00Z', attribute_type: 'text', value: 'gone' }],
        empty: []
    }
};

describe('attio', () => {

    describe('lib.simplifyValues', () => {
        it('flattens attribute values by type and drops historic values', () => {
            const values = lib.simplifyValues(RECORD.values);
            assert.deepStrictEqual(values, {
                name: 'Jane Doe',
                email_addresses: ['jane@acme.com', 'jd@acme.com'],
                stage: 'Lead',
                old: null,
                empty: null
            });
        });
    });

    describe('CreatePerson', () => {
        it('builds person values and maps the created record', async () => {
            const context = createContext({
                input: { firstName: 'Jane', lastName: 'Doe', emailAddresses: 'jane@acme.com, jd@acme.com', companyId: 'c-1' },
                responder: () => ({ data: RECORD })
            });
            await CreatePerson.receive(context);
            const request = context.requests[0];
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(request.url, 'https://api.attio.com/v2/objects/people/records');
            assert.strictEqual(request.headers.Authorization, 'Bearer test-token');
            assert.deepStrictEqual(request.data.data.values, {
                name: { first_name: 'Jane', last_name: 'Doe', full_name: 'Jane Doe' },
                email_addresses: ['jane@acme.com', 'jd@acme.com'],
                company: [{ target_object: 'companies', target_record_id: 'c-1' }]
            });
            assert.strictEqual(context.sent[0].data.id, 'rec-1');
            assert.strictEqual(context.sent[0].data.values.name, 'Jane Doe');
        });

        it('refuses an empty person', async () => {
            const context = createContext({ input: {} });
            await assert.rejects(() => CreatePerson.receive(context), CancelError);
        });
    });

    describe('FindPeople', () => {
        it('filters by email and name, and emits notFound on no match', async () => {
            const context = createContext({
                input: { emailAddress: 'jane@acme.com', name: 'Jane', outputType: 'array' },
                responder: () => ({ data: [] })
            });
            await FindPeople.receive(context);
            assert.deepStrictEqual(context.requests[0].data.filter, {
                $and: [
                    { email_addresses: { email_address: { $eq: 'jane@acme.com' } } },
                    { name: { full_name: { $contains: 'Jane' } } }
                ]
            });
            assert.strictEqual(context.sent[0].port, 'notFound');
        });

        it('returns the first record', async () => {
            const context = createContext({
                input: { outputType: 'first' },
                responder: () => ({ data: [RECORD] })
            });
            await FindPeople.receive(context);
            assert.strictEqual(context.requests[0].data.filter, undefined);
            assert.strictEqual(context.sent[0].port, 'out');
            assert.strictEqual(context.sent[0].data.id, 'rec-1');
            assert.strictEqual(context.sent[0].data.count, 1);
        });
    });

    describe('UpdateRecord', () => {
        it('PATCHes by default and PUTs when overwriting multiselect values', async () => {
            for (const [overwrite, method] of [[false, 'PATCH'], [true, 'PUT']]) {
                const context = createContext({
                    input: { objectId: 'companies', recordId: 'rec-1', values: '{"description":"x"}', overwriteMultiselect: overwrite }
                });
                await UpdateRecord.receive(context);
                assert.strictEqual(context.requests[0].method, method);
                assert.deepStrictEqual(context.requests[0].data, { data: { values: { description: 'x' } } });
                assert.deepStrictEqual(context.sent[0], { data: {}, port: 'out' });
            }
        });

        it('rejects invalid JSON values', async () => {
            const context = createContext({ input: { objectId: 'companies', recordId: 'rec-1', values: '{nope' } });
            await assert.rejects(() => UpdateRecord.receive(context), CancelError);
        });
    });

    describe('UpdatePerson', () => {
        it('keeps the current last name when only the first name is changed', async () => {
            const context = createContext({
                input: { recordId: 'rec-1', firstName: 'Janet' },
                responder: ({ method }) => (method === 'GET' ? { data: RECORD } : { data: RECORD })
            });
            await UpdatePerson.receive(context);
            assert.strictEqual(context.requests[0].method, 'GET');
            const update = context.requests[1];
            assert.strictEqual(update.method, 'PATCH');
            assert.ok(update.url.endsWith('/v2/objects/people/records/rec-1'));
            assert.deepStrictEqual(update.data.data.values.name, {
                first_name: 'Janet', last_name: 'Doe', full_name: 'Janet Doe'
            });
            assert.deepStrictEqual(context.sent[0], { data: {}, port: 'out' });
        });

        it('does not read the record when the name is not changed', async () => {
            const context = createContext({ input: { recordId: 'rec-1', jobTitle: 'CTO' } });
            await UpdatePerson.receive(context);
            assert.strictEqual(context.requests.length, 1);
            assert.deepStrictEqual(context.requests[0].data, { data: { values: { job_title: 'CTO' } } });
        });

        it('rejects an update without values', async () => {
            const context = createContext({ input: { recordId: 'rec-1' } });
            await assert.rejects(() => UpdatePerson.receive(context), CancelError);
        });
    });

    describe('UploadFile', () => {
        it('uploads the file as multipart form data to the record', async () => {
            const context = createContext({
                input: { objectId: 'people', recordId: 'rec-1', fileId: 'file-1' },
                responder: () => ({
                    data: {
                        id: { workspace_id: 'ws-1', file_id: 'f-1' },
                        object_slug: 'people',
                        record_id: 'rec-1',
                        name: 'contract.pdf',
                        storage_provider: 'attio'
                    }
                })
            });
            context.getFileInfo = async () => ({ filename: 'contract.pdf', contentType: 'application/pdf', length: 3 });
            context.getFileReadStream = async () => Readable.from([Buffer.from('pdf')]);
            await UploadFile.receive(context);
            const request = context.requests[0];
            assert.strictEqual(request.url, 'https://api.attio.com/v2/files/upload');
            assert.ok(request.headers['content-type'].startsWith('multipart/form-data; boundary='));
            assert.strictEqual(request.headers['Content-Type'], undefined);
            assert.strictEqual(context.sent[0].data.id, 'f-1');
            assert.strictEqual(context.sent[0].data.name, 'contract.pdf');
        });

        it('rejects files over 50 MB', async () => {
            const context = createContext({ input: { objectId: 'people', recordId: 'rec-1', fileId: 'file-1' } });
            context.getFileInfo = async () => ({ filename: 'big.bin', length: 51 * 1024 * 1024 });
            await assert.rejects(() => UploadFile.receive(context), CancelError);
        });
    });

    describe('FindListEntries', () => {
        it('filters by parent record with the documented path filter', async () => {
            const context = createContext({
                input: { listId: 'sales', parentRecordId: 'rec-1', outputType: 'array' },
                responder: (options) => {
                    if (options.method === 'GET') {
                        return { data: { api_slug: 'sales', parent_object: ['companies'] } };
                    }
                    return { data: [{ id: { list_id: 'l-1', entry_id: 'e-1' }, parent_record_id: 'rec-1', parent_object: 'companies', entry_values: {} }] };
                }
            });
            await FindListEntries.receive(context);
            assert.deepStrictEqual(context.requests[1].data.filter, {
                path: [['sales', 'parent_record'], ['companies', 'record_id']],
                constraints: { value: 'rec-1' }
            });
            assert.strictEqual(context.sent[0].data.result[0].id, 'e-1');
        });
    });

    describe('MakeApiCall', () => {
        it('prefixes paths with the Attio API origin', async () => {
            const context = createContext({ input: { url: '/v2/self', method: 'GET' }, responder: () => ({ active: true }) });
            await MakeApiCall.receive(context);
            assert.strictEqual(context.requests[0].url, 'https://api.attio.com/v2/self');
            assert.strictEqual(context.sent[0].data.body.active, true);
        });

        it('never sends the token to another origin', async () => {
            const context = createContext({ input: { url: 'https://evil.example.com/v2/self', method: 'GET' } });
            await assert.rejects(() => MakeApiCall.receive(context), CancelError);
            assert.strictEqual(context.requests.length, 0);
        });
    });

    describe('NewRecord', () => {
        it('registers a webhook filtered to the object UUID', async () => {
            const context = createContext({
                properties: { objectId: 'companies' },
                responder: (options) => {
                    if (options.method === 'GET') return { data: { id: { object_id: 'obj-uuid' } } };
                    return { data: { id: { webhook_id: 'wh-1' }, secret: 's' } };
                }
            });
            await NewRecord.start(context);
            const create = context.requests[1];
            assert.strictEqual(create.url, 'https://api.attio.com/v2/webhooks');
            assert.deepStrictEqual(create.data.data.subscriptions, [{
                event_type: 'record.created',
                filter: { $and: [{ field: 'id.object_id', operator: 'equals', value: 'obj-uuid' }] }
            }]);
            assert.deepStrictEqual(context.state, { webhookId: 'wh-1' });
        });

        it('enriches events, drops duplicates, foreign webhooks and deleted records', async () => {
            const webhook = {
                headers: { 'idempotency-key': 'key-1' },
                data: {
                    webhook_id: 'wh-1',
                    events: [
                        { event_type: 'record.created', id: { object_id: 'obj-1', record_id: 'rec-1' }, actor: { type: 'workspace-member', id: 'm-1' } },
                        { event_type: 'record.created', id: { object_id: 'obj-1', record_id: 'gone' }, actor: { type: 'api-token', id: 't-1' } }
                    ]
                }
            };
            const responder = (options) => {
                if (options.url.endsWith('/gone')) {
                    const err = new Error('Not found');
                    err.response = { status: 404, data: { status_code: 404, code: 'not_found', message: 'Record not found' } };
                    throw err;
                }
                return { data: RECORD };
            };
            const context = createContext({ webhook, state: { webhookId: 'wh-1' }, responder });
            const result = await NewRecord.receive(context);
            assert.strictEqual(result, 'ack');
            assert.strictEqual(context.sent.length, 1);
            assert.strictEqual(context.sent[0].data.id, 'rec-1');
            assert.deepStrictEqual(context.sent[0].data.actor, { type: 'workspace-member', id: 'm-1' });

            // The same delivery again (Attio retry) is ignored.
            context.sent = [];
            await NewRecord.receive(context);
            assert.strictEqual(context.sent.length, 0);

            // A delivery of another webhook is ignored.
            const other = createContext({
                webhook: { headers: {}, data: { ...webhook.data, webhook_id: 'wh-other' } },
                state: { webhookId: 'wh-1' },
                responder
            });
            await NewRecord.receive(other);
            assert.strictEqual(other.sent.length, 0);
        });
    });
});
