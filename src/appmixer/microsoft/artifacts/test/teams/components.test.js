const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../../../../../test/utils.js');
const lib = require('../../../teams/lib.js');
const { chatMessage } = require('../../../teams/schemas.js');
const ListTeams = require('../../../teams/ListTeams/ListTeams.js');
const ListChannels = require('../../../teams/ListChannels/ListChannels.js');
const ListChannelMessages = require('../../../teams/ListChannelMessages/ListChannelMessages.js');
const SendChannelMessage = require('../../../teams/SendChannelMessage/SendChannelMessage.js');
const MakeApiCall = require('../../../teams/MakeApiCall/MakeApiCall.js');
const sendChannelMessageJson = require('../../../teams/SendChannelMessage/component.json');

const TEAM_ID = 'fbe2bf47-16c8-47cf-b4a5-4b9b187c508b';
const CHANNEL_ID = '19:4a95f7d8db4c4e7fae857bcebe0623e6@thread.tacv2';
const ENCODED_CHANNEL_ID = '19%3A4a95f7d8db4c4e7fae857bcebe0623e6%40thread.tacv2';

const graphError = (status, headers = {}) => Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, headers, data: { error: { code: 'TooManyRequests', message: 'Throttled' } } }
});

describe('Microsoft Teams', function() {

    let context;

    beforeEach(function() {

        context = testUtils.createMockContext();
        context.auth = { accessToken: 'token' };
        context.properties = {};
        context.saveFileStream = sinon.stub().resolves({ fileId: 'file-1' });
    });

    describe('lib.listAll', function() {

        it('follows @odata.nextLink until the last page', async function() {

            context.httpRequest.onFirstCall().resolves({
                data: { value: [{ id: '1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next?$skiptoken=x' }
            });
            context.httpRequest.onSecondCall().resolves({ data: { value: [{ id: '2' }] } });

            const records = await lib.listAll(context, '/me/joinedTeams', { $top: 50 });

            assert.deepStrictEqual(records, [{ id: '1' }, { id: '2' }]);
            assert.strictEqual(context.httpRequest.callCount, 2);
            assert.strictEqual(context.httpRequest.args[0][0].url, 'https://graph.microsoft.com/v1.0/me/joinedTeams');
            assert.deepStrictEqual(context.httpRequest.args[0][0].params, { $top: 50 });
            assert.strictEqual(context.httpRequest.args[1][0].url, 'https://graph.microsoft.com/v1.0/next?$skiptoken=x');
            assert.strictEqual(context.httpRequest.args[1][0].params, undefined);
        });

        it('retries a throttled request honouring Retry-After', async function() {

            context.httpRequest.onFirstCall().rejects(graphError(429, { 'retry-after': '0' }));
            context.httpRequest.onSecondCall().resolves({ data: { value: [{ id: '1' }] } });

            const records = await lib.listAll(context, '/me/joinedTeams');

            assert.deepStrictEqual(records, [{ id: '1' }]);
            assert.strictEqual(context.httpRequest.callCount, 2);
        });

        it('surfaces the Graph error when retries run out', async function() {

            context.httpRequest.rejects(graphError(429, { 'retry-after': '0' }));

            await assert.rejects(lib.listAll(context, '/me/joinedTeams'), /Microsoft Graph error TooManyRequests: Throttled/);
            assert.strictEqual(context.httpRequest.callCount, 4);
        });
    });

    describe('lib.sendArrayOutput', function() {

        const records = [
            { id: '1', body: { content: 'Hello, "world"' } },
            { id: '2', body: { content: 'line\nbreak' } }
        ];

        it('array sends the records once under result', async function() {

            await lib.sendArrayOutput({ context, outputType: 'array', records });

            assert.strictEqual(context.sendJson.callCount, 1);
            assert.deepStrictEqual(context.sendJson.args[0], [{ result: records, count: 2 }, 'out']);
        });

        it('object sends one message per record', async function() {

            await lib.sendArrayOutput({ context, outputType: 'object', records });

            assert.strictEqual(context.sendJson.callCount, 2);
            assert.deepStrictEqual(context.sendJson.args[1][0], { ...records[1], index: 1, count: 2 });
        });

        it('first sends only the first record and throws when there is none', async function() {

            await lib.sendArrayOutput({ context, outputType: 'first', records });
            assert.strictEqual(context.sendJson.callCount, 1);
            assert.strictEqual(context.sendJson.args[0][0].id, '1');

            await assert.rejects(lib.sendArrayOutput({ context, outputType: 'first', records: [] }), context.CancelError);
        });

        it('file writes an escaped CSV', async function() {

            await lib.sendArrayOutput({ context, outputType: 'file', records });

            const csv = context.saveFileStream.args[0][1].toString('utf8');
            assert.strictEqual(csv, [
                'id,body',
                '1,"{""content"":""Hello, \\""world\\""""}"',
                '2,"{""content"":""line\\nbreak""}"'
            ].join('\n'));
            assert.deepStrictEqual(context.sendJson.args[0], [{ fileId: 'file-1' }, 'out']);
        });
    });

    describe('ListTeams', function() {

        const teams = [{ id: TEAM_ID, displayName: 'Marketing', description: 'Marketing team' }];

        it('lists the joined teams', async function() {

            context.messages = { in: { content: { outputType: 'array' } } };
            context.httpRequest.resolves({ data: { value: teams } });

            await ListTeams.receive(context);

            assert.strictEqual(context.httpRequest.args[0][0].url, 'https://graph.microsoft.com/v1.0/me/joinedTeams');
            assert.deepStrictEqual(context.sendJson.args[0], [{ result: teams, count: 1 }, 'out']);
        });

        it('generates output port options without calling Graph', async function() {

            context.messages = { in: { content: { outputType: 'array' } } };
            context.properties = { generateOutputPortOptions: true };

            await ListTeams.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 0);
            const [options] = context.sendJson.args[0];
            assert.deepStrictEqual(options[1].schema.items.properties, ListTeams.ITEM_SCHEMA.properties);
        });

        it('source call is cached', async function() {

            context.messages = { in: { content: { outputType: 'array', isSource: true } } };
            context.httpRequest.resolves({ data: { value: teams } });

            await ListTeams.receive(context);
            await ListTeams.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 1);
            const expected = { result: [{ id: TEAM_ID, displayName: 'Marketing' }] };
            assert.deepStrictEqual(context.sendJson.args[0][0], expected);
            assert.deepStrictEqual(context.sendJson.args[1][0], expected);
            assert.strictEqual(context.lock.callCount, 2);
        });

        it('source call returns an empty list on error', async function() {

            context.messages = { in: { content: { outputType: 'array', isSource: true } } };
            context.httpRequest.rejects(graphError(401));

            await ListTeams.receive(context);

            assert.deepStrictEqual(context.sendJson.args[0][0], { result: [] });
        });

        it('toSelectArray maps the current and the legacy output', function() {

            const expected = [{ label: 'Marketing', value: TEAM_ID }];
            assert.deepStrictEqual(ListTeams.toSelectArray({ result: teams }), expected);
            assert.deepStrictEqual(ListTeams.teamsToSelectArray(teams), expected);
            assert.deepStrictEqual(ListTeams.toSelectArray(undefined), []);
        });
    });

    describe('ListChannels', function() {

        const channels = [{ id: CHANNEL_ID, displayName: 'General' }];

        it('lists the channels of a team', async function() {

            context.messages = { in: { content: { teamId: TEAM_ID, outputType: 'first' } } };
            context.httpRequest.resolves({ data: { value: channels } });

            await ListChannels.receive(context);

            assert.strictEqual(
                context.httpRequest.args[0][0].url,
                `https://graph.microsoft.com/v1.0/teams/${TEAM_ID}/channels`
            );
            assert.deepStrictEqual(context.sendJson.args[0][0], { ...channels[0], index: 0, count: 1 });
        });

        it('requires a team', async function() {

            context.messages = { in: { content: { outputType: 'array' } } };

            await assert.rejects(ListChannels.receive(context), /Team is required!/);
        });

        it('source call without a team returns an empty list without calling Graph', async function() {

            context.messages = { in: { content: { outputType: 'array', isSource: true } } };

            await ListChannels.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 0);
            assert.deepStrictEqual(context.sendJson.args[0][0], { result: [] });
        });

        it('source call caches per team', async function() {

            context.httpRequest.resolves({ data: { value: channels } });

            context.messages = { in: { content: { teamId: TEAM_ID, isSource: true } } };
            await ListChannels.receive(context);
            await ListChannels.receive(context);
            context.messages = { in: { content: { teamId: 'other-team', isSource: true } } };
            await ListChannels.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 2);
        });
    });

    describe('ListChannelMessages', function() {

        it('pages through the messages with $top=50 and encodes the path', async function() {

            context.messages = { in: { content: { teamId: TEAM_ID, channelId: CHANNEL_ID, outputType: 'array' } } };
            context.httpRequest.onFirstCall().resolves({
                data: { value: [{ id: '1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next' }
            });
            context.httpRequest.onSecondCall().resolves({ data: { value: [{ id: '2' }] } });

            await ListChannelMessages.receive(context);

            assert.strictEqual(
                context.httpRequest.args[0][0].url,
                `https://graph.microsoft.com/v1.0/teams/${TEAM_ID}/channels/${ENCODED_CHANNEL_ID}/messages`
            );
            assert.deepStrictEqual(context.httpRequest.args[0][0].params, { $top: 50 });
            // "All at once" sends exactly one message.
            assert.strictEqual(context.sendJson.callCount, 1);
            assert.deepStrictEqual(context.sendJson.args[0], [{ result: [{ id: '1' }, { id: '2' }], count: 2 }, 'out']);
        });

        it('requires a team and a channel', async function() {

            context.messages = { in: { content: { channelId: CHANNEL_ID } } };
            await assert.rejects(ListChannelMessages.receive(context), /Team is required!/);

            context.messages = { in: { content: { teamId: TEAM_ID } } };
            await assert.rejects(ListChannelMessages.receive(context), /Channel is required!/);
        });

        it('output port options use the chatMessage schema', async function() {

            context.messages = { in: { content: { teamId: 'dummy', channelId: 'dummy', outputType: 'object' } } };
            context.properties = { generateOutputPortOptions: true };

            await ListChannelMessages.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 0);
            const body = context.sendJson.args[0][0].find((option) => option.value === 'body');
            assert.strictEqual(body.schema.type, 'object');
            assert.strictEqual(body.schema.properties.content.title, 'Body.Content');
        });
    });

    describe('SendChannelMessage', function() {

        it('posts the message to the encoded channel path', async function() {

            const message = { id: '1616990032035', body: { contentType: 'text', content: 'Hi' } };
            context.messages = { in: { content: { teamId: TEAM_ID, channelId: CHANNEL_ID, content: 'Hi' } } };
            context.httpRequest.resolves({ data: message });

            await SendChannelMessage.receive(context);

            const request = context.httpRequest.args[0][0];
            assert.strictEqual(request.method, 'POST');
            assert.strictEqual(
                request.url,
                `https://graph.microsoft.com/v1.0/teams/${TEAM_ID}/channels/${ENCODED_CHANNEL_ID}/messages`
            );
            assert.deepStrictEqual(request.data, { body: { contentType: 'text', content: 'Hi' } });
            assert.deepStrictEqual(context.sendJson.args[0], [message, 'out']);
        });

        for (const [field, error] of [['teamId', 'Team'], ['channelId', 'Channel'], ['content', 'Content']]) {
            it(`requires ${field}`, async function() {

                const content = { teamId: TEAM_ID, channelId: CHANNEL_ID, content: 'Hi' };
                delete content[field];
                context.messages = { in: { content } };

                await assert.rejects(SendChannelMessage.receive(context), new RegExp(`${error} is required!`));
                assert.strictEqual(context.httpRequest.callCount, 0);
            });
        }

        it('declares the shared chatMessage schema on its output port', function() {

            // JSON round-trip drops nothing here, but normalizes the object for comparison.
            assert.deepStrictEqual(sendChannelMessageJson.outPorts[0].schema, JSON.parse(JSON.stringify(chatMessage)));
        });
    });

    describe('MakeApiCall', function() {

        it('wraps Graph errors', async function() {

            context.messages = { in: { content: { url: '/me/joinedTeams', method: 'GET' } } };
            context.httpRequest.rejects(graphError(403));

            await assert.rejects(MakeApiCall.receive(context), /Microsoft Graph error TooManyRequests: Throttled/);
        });
    });
});
