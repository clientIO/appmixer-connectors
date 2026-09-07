const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../test-utils');
const action = require('../../../../dynamics/CreateObjectRecord/CreateObjectRecord');

describe('CreateObjectRecord', function() {

    const context = testUtils.createMockContext();

    beforeEach(function() {

        sinon.reset();
    });

    describe('Lead', function() {

        describe('receive - create', function() {

            const leadResponseStub = {
                data: {
                    '@odata.etag': 'W/"113212"',
                    leadid: '2fa944ce-677d-ee11-8179-0022488947ed',
                    subject: 'Test Lead',
                    lastname: 'Lead',
                    emailaddress1: 'd@client.io',
                    'parentaccountid@odata.bind': '/accounts(999944ce-eeee-ee11-8179-0022488947ed)'
                },
                headers: {
                    'odata-entityid': 'https://org422b05be.crm4.dynamics.com/api/data/v9.2/leads(2fa944ce-677d-ee11-8179-0022488947ed)'
                }
            };

            beforeEach(function() {

                // Stub the httpRequest function.
                context.httpRequest = sinon.stub().resolves(leadResponseStub);
                // The entity-set (collection) segment is resolved from the metadata API
                // and cached; serve it from the cache so only the create request runs.
                context.staticCache.get = sinon.stub().resolves('leads');
            });

            it('should call httpRequest with correct options', async function() {

                // Set properties.
                context.properties = {};
                // Set input message.
                context.messages = {
                    in: {
                        content: {
                            objectName: 'lead',
                            subject: leadResponseStub.data.subject,
                            lastname: leadResponseStub.data.lastname,
                            emailaddress1: leadResponseStub.data.emailaddress1,
                            // Note: The pipe character is used in the input and transformed to a dot in the component
                            'parentaccountid@odata|bind': leadResponseStub.data['parentaccountid@odata.bind']
                        }
                    }
                };

                await action.receive(context);

                // Assert that the httpRequest function was called.
                assert.equal(context.httpRequest.callCount, 1, 'should call httpRequest once');
                assert.equal(context.httpRequest.args[0][0].method, 'POST', 'should call httpRequest with correct method');
                assert.equal(context.httpRequest.args[0][0].url, `${context.resource}/api/data/v9.2/leads`, 'should call httpRequest with correct url');
                const data = context.httpRequest.args[0][0].data;
                assert.ok(data['parentaccountid@odata.bind'], 'should call httpRequest with correct @odata.bind');

                // Assert that the sendJson function was called.
                assert.equal(context.sendJson.callCount, 1, 'should call sendJson once');
                assert.equal(context.sendJson.args[0][0].objectName, 'lead', 'should call sendJson with correct objectName');
                assert.equal(context.sendJson.args[0][0].id, leadResponseStub.data.leadid, 'should call sendJson with correct id');
            });

            it('should resolve the entity set from metadata on cache miss (irregular plurals)', async function() {

                context.staticCache.get = sinon.stub().resolves(undefined);
                context.httpRequest = sinon.stub();
                // First call: EntityDefinitions metadata lookup; second call: the create.
                context.httpRequest.onFirstCall().resolves({ data: { EntitySetName: 'opportunities' } });
                context.httpRequest.onSecondCall().resolves(leadResponseStub);

                context.properties = {};
                context.messages = { in: { content: { objectName: 'opportunity', subject: 'Test' } } };

                await action.receive(context);

                assert.equal(context.httpRequest.callCount, 2, 'should call metadata + create');
                assert.ok(
                    context.httpRequest.args[0][0].url.includes("EntityDefinitions(LogicalName='opportunity')"),
                    'first request resolves the entity set from metadata');
                assert.equal(
                    context.httpRequest.args[1][0].url,
                    `${context.resource}/api/data/v9.2/opportunities`,
                    'create uses the resolved entity set, not a naive plural');
                assert.equal(context.staticCache.set.callCount, 1, 'caches the resolved entity set');
            });
        });
    });
});
