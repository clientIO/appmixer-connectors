const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../utils.js');
const routes = require('../../src/appmixer/imperva/routes.js');
const x = require('../../src/appmixer/microsoft/sharepoint/FindFilesOrFolders/FindFilesOrFolders');

describe('POST /rules-block-ips handler', () => {

    let context = testUtils.createMockContext();
    let handler;

    // Fixtures common to all tests.
    const SITE_ID = 33;
    const AFTER_10_MINUTES = new Date().getTime() + 600000;
    const AUTH = { id: 'test-unit-id', key: 'test-unit-key' };

    beforeEach(async () => {

        // Reset the context
        context = {
            ...testUtils.createMockContext(),
            // Routes/plugins specific stubs
            http: {
                router: {
                    register: sinon.stub()
                }
            }
        };

        // Register the routes the same way Appmixer does.
        await routes(context);
        handler = context.http.router.register.getCall(0).args[0].options.handler;
        // Stub the 1st call to httpRequest to check for number of existing rules.
        context.httpRequest.onCall(0).resolves({ data: { incap_rules: { All: [] } } });
    });

    describe('No initial records', () => {

        it('1 new IP, no previous records', async () => {

            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 1 });
            // Stub the 1st DB call to find existing records. No existing records.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves([])
            });

            const IP = '1.1.1.1';
            const IMPERVA_RULES_RESPONSE = {
                rule_id: 3648,
                name: 'Custom IP Block Rule 1734039281612 1',
                action: 'RULE_ACTION_BLOCK',
                filter: `ClientIP == ${IP}`
            };
            // Stub API call to Imperva to create 1 rule.
            context.httpRequest.resolves({ data: IMPERVA_RULES_RESPONSE });

            // The payload contains 1 new IP.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: [IP],
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.equal(result.error, undefined, 'should not return an error');

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');
            const insertManyArgsExpected = {
                siteId: SITE_ID,
                ip: IP,
                ruleId: IMPERVA_RULES_RESPONSE.rule_id,
                removeAfter: AFTER_10_MINUTES,
                auth: AUTH
            };
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0][0];
            assert.deepEqual(
                insertManyArgs,
                insertManyArgsExpected,
                'should insert the correct record in MongoDB'
            );
            // Expecting 1 call to create a new rule in Imperva.
            assert.equal(context.httpRequest.callCount, 2, 'httpRequest should be called once');
            const httpRequestArgs = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequestArgs.url, /v2\/sites\/\d+\/rules$/);
            assert.equal(httpRequestArgs.method, 'POST');
            assert.equal(httpRequestArgs.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs.data.name, /Custom IP Block Rule \d+ 1/);
            assert.equal(httpRequestArgs.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequestArgs.data.filter, `ClientIP == ${IP}`);
        });

        it('1 new IP, no previous records', async () => {

            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 1 });
            // Stub the 1st DB call to find existing records. No existing records.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves([])
            });

            const IP = '1.1.1.1';
            const IMPERVA_RULES_RESPONSE = {
                rule_id: 3648,
                name: 'Custom IP Block Rule 1734039281612 1',
                action: 'RULE_ACTION_BLOCK',
                filter: `ClientIP == ${IP}`
            };
            // Stub API call to Imperva to create 1 rule.
            context.httpRequest.resolves({ data: IMPERVA_RULES_RESPONSE });

            // The payload contains 1 new IP.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: [IP],
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.equal(result.error, undefined, 'should not return an error');

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');
            const insertManyArgsExpected = {
                siteId: SITE_ID,
                ip: IP,
                ruleId: IMPERVA_RULES_RESPONSE.rule_id,
                removeAfter: AFTER_10_MINUTES,
                auth: AUTH
            };
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0][0];
            assert.deepEqual(
                insertManyArgs,
                insertManyArgsExpected,
                'should insert the correct record in MongoDB'
            );
            // Expecting 1 call to create a new rule in Imperva.
            assert.equal(context.httpRequest.callCount, 2, 'httpRequest should be called once');
            const httpRequestArgs = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequestArgs.url, /v2\/sites\/\d+\/rules$/);
            assert.equal(httpRequestArgs.method, 'POST');
            assert.equal(httpRequestArgs.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs.data.name, /Custom IP Block Rule \d+ 1/);
            assert.equal(httpRequestArgs.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequestArgs.data.filter, `ClientIP == ${IP}`);
        });

        it('21 new IPs, no previous records', async () => {

            // const { driveId, q, parentPath, fileTypesRestriction, outputType } =

            context.messages.in.content = {
                driveId: 'sdkjf'
                driveId: 'sdkjf'
            }

            x.receive(context)
                siteId: SITE_ID,
                ip,
                // 13642 is the first rule id, 13643 is the second rule id.
                ruleId: i < 20 ? 13642 : 13643,
                removeAfter: AFTER_10_MINUTES,
                auth: AUTH
            }));
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0];
            assert.deepEqual(
                insertManyArgs,
                insertManyArgsExpected,
                'should insert the correct records in MongoDB'
            );
            // Expecting 2 calls to create new rules in Imperva.
            assert.equal(context.httpRequest.callCount, 3, 'POST httpRequest should be called twice');
            // First call
            const httpRequestArgs1 = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequestArgs1.url, /v2\/sites\/\d+\/rules$/);
            assert.equal(httpRequestArgs1.method, 'POST');
            assert.equal(httpRequestArgs1.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs1.data.name, /Custom IP Block Rule \d+ 1/);
            assert.equal(httpRequestArgs1.data.action, 'RULE_ACTION_BLOCK');
            assert.match(httpRequestArgs1.data.filter, /ClientIP == 1\.1\.1\.1/);
            assert.match(httpRequestArgs1.data.filter, /ClientIP == 1\.1\.1\.20/);
            // Second call
            const httpRequestArgs2 = context.httpRequest.getCall(2).args[0];
            assert.match(httpRequestArgs2.url, /v2\/sites\/\d+\/rules$/);
            assert.equal(httpRequestArgs2.method, 'POST');
            assert.equal(httpRequestArgs2.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs2.data.name, /Custom IP Block Rule \d+ 2/);
            assert.equal(httpRequestArgs2.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequestArgs2.data.filter, 'ClientIP == 1\.1\.1\.21');
        });
    });

    describe('Existing records', () => {

        // 2 rules in Imperva with 19 and 1 IPs respectively.
        // Inserting 2 new IPs.
        it('2 existing rules, 10 new IPs', async () => {

            const EXISTING_IPS = Array.from({ length: 20 }, (_, i) => `1.1.1.${i + 1}`);
            const NEW_IPS = Array.from({ length: 10 }, (_, i) => `2.2.2.${i + 1}`);
            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 10 });
            // Stub the 1st DB call to find existing records. No existing records.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves(EXISTING_IPS.map((ip, i) => ({
                    siteId: SITE_ID,
                    ip,
                    ruleId: i < 19 ? 23642 : 23643,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                })))
            });

            const IMPERVA_RULES_RESPONSE_PUT = {
                name: 'Custom IP Block Rule 1734039281612 ',
                action: 'RULE_ACTION_BLOCK'
            };
            // Stub API calls to Imperva to update 2 rules.
            context.httpRequest.onCall(1).resolves({ data: {
                ...IMPERVA_RULES_RESPONSE_PUT,
                rule_id: 23642,
                name: IMPERVA_RULES_RESPONSE_PUT.name + '1',
                filter: EXISTING_IPS.slice(0, 19).concat(NEW_IPS.slice(0, 1)).map(ip => `ClientIP == ${ip}`).join(' & ')
            } });
            context.httpRequest.onCall(2).resolves({ data: {
                ...IMPERVA_RULES_RESPONSE_PUT,
                rule_id: 23643,
                name: IMPERVA_RULES_RESPONSE_PUT.name + '2',
                filter: EXISTING_IPS.slice(19).concat(NEW_IPS.slice(1)).map(ip => `ClientIP == ${ip}`).join(' & ')
            } });

            // The payload contains 1 new IP.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: NEW_IPS,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.equal(result.error, undefined, 'should not return an error');
            assert.deepEqual(result.processed, [
                { ruleId: 23642, ip: NEW_IPS[0] },
                { ruleId: 23643, ip: NEW_IPS[1] },
                { ruleId: 23643, ip: NEW_IPS[2] },
                { ruleId: 23643, ip: NEW_IPS[3] },
                { ruleId: 23643, ip: NEW_IPS[4] },
                { ruleId: 23643, ip: NEW_IPS[5] },
                { ruleId: 23643, ip: NEW_IPS[6] },
                { ruleId: 23643, ip: NEW_IPS[7] },
                { ruleId: 23643, ip: NEW_IPS[8] },
                { ruleId: 23643, ip: NEW_IPS[9] }
            ]);

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');

            // Assert MongoDB records.
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0];
            assert.equal(insertManyArgs.length, 10, 'should insert 10 new records in MongoDB');

            // Assert the first new IP in MongoDB.
            assert.deepEqual(insertManyArgs[0], {
                siteId: SITE_ID, removeAfter: AFTER_10_MINUTES, auth: AUTH,
                ip: NEW_IPS[0],
                ruleId: 23642 // The first rule id.
            });
            // Assert the last new IP in MongoDB.
            assert.deepEqual(insertManyArgs[9], {
                siteId: SITE_ID, removeAfter: AFTER_10_MINUTES, auth: AUTH,
                ip: NEW_IPS[9],
                ruleId: 23643 // The second rule id.
            });

            // Expecting 2 calls to update rules in Imperva.
            // Assert 1st update call.
            assert.equal(context.httpRequest.callCount, 3, 'PUT httpRequest should be called twice');
            const httpRequest1Args = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequest1Args.url, /v2\/sites\/\d+\/rules\/\d+$/);
            assert.equal(httpRequest1Args.method, 'PUT');
            assert.equal(httpRequest1Args.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequest1Args.data.name, /Custom IP Block Rule \d+/);
            assert.equal(httpRequest1Args.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequest1Args.data.filter, EXISTING_IPS.slice(0, 19).concat(NEW_IPS.slice(0, 1)).map(ip => `ClientIP == ${ip}`).join(' & '));
            // Assert 2nd update call.
            const httpRequest2Args = context.httpRequest.getCall(2).args[0];
            assert.match(httpRequest2Args.url, /v2\/sites\/\d+\/rules\/\d+$/);
            assert.equal(httpRequest2Args.method, 'PUT');
            assert.equal(httpRequest2Args.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequest2Args.data.name, /Custom IP Block Rule \d+/);
            assert.equal(httpRequest2Args.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequest2Args.data.filter, EXISTING_IPS.slice(19).concat(NEW_IPS.slice(1)).map(ip => `ClientIP == ${ip}`).join(' & '));
        });

        it('2 blocked IPs in 1 rule, adding 1 new IP and one existing IP', async () => {

            const EXISTING_IPS = ['4.4.4.4', '5.5.5.5'];
            const EXISTING_RECORDS = EXISTING_IPS.map((ip, i) => ({
                siteId: SITE_ID,
                ip,
                ruleId: 82938,
                removeAfter: AFTER_10_MINUTES,
                auth: AUTH
            }));
            const NEW_IPS = ['4.4.4.4', '6.6.6.6'];
            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 1 });
            // Stub `updateMany` method of MongoDB collection.
            context.db.collection().updateMany.resolves({ modifiedCount: 1 });
            // Stub the 1st DB call to find existing records. Returns the first IP.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([EXISTING_RECORDS[0]])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves(EXISTING_RECORDS)
            });

            const IMPERVA_RULES_RESPONSE_PUT = {
                name: 'Custom IP Block Rule 1734039281612 ',
                action: 'RULE_ACTION_BLOCK'
            };
            // Stub API calls to Imperva to update 1 rule.
            context.httpRequest.onCall(1).resolves({ data: {
                ...IMPERVA_RULES_RESPONSE_PUT,
                rule_id: 82938,
                name: IMPERVA_RULES_RESPONSE_PUT.name + '1',
                filter: EXISTING_IPS.concat(NEW_IPS.slice(1)).map(ip => `ClientIP == ${ip}`).join(' & ')
            } });

            // The payload contains 1 new IP.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: NEW_IPS,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.equal(result.error, undefined, 'should not return an error');
            assert.deepEqual(result.processed, [
                { ruleId: 82938, ip: NEW_IPS[0] },
                { ruleId: 82938, ip: NEW_IPS[1] }
            ]);

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');

            // Assert MongoDB records.
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0];
            assert.equal(insertManyArgs.length, 1, 'should insert 1 new record in MongoDB');

            // Assert the new IP in MongoDB.
            assert.deepEqual(insertManyArgs[0], {
                siteId: SITE_ID, removeAfter: AFTER_10_MINUTES, auth: AUTH,
                ip: NEW_IPS[1],
                ruleId: 82938 // The first rule id.
            });

            // Expecting 1 call to update rules in Imperva.
            // Assert update call.
            assert.equal(context.httpRequest.callCount, 2, 'PUT httpRequest should be called once');
            const httpRequestArgs = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequestArgs.url, /v2\/sites\/\d+\/rules\/\d+$/);
            assert.equal(httpRequestArgs.method, 'PUT');
            assert.equal(httpRequestArgs.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs.data.name, /Custom IP Block Rule \d+/);
            assert.equal(httpRequestArgs.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequestArgs.data.filter, EXISTING_IPS.concat(NEW_IPS.slice(1)).map(ip => `ClientIP == ${ip}`).join(' & '));
        });

        it('1000 new IPs, 100 existing rules with 19 IPs each', async () => {

            const EXISTING_IPS = Array.from({ length: 1900 }, (_, i) => `1.1.1.${i + 1}`);
            const NEW_IPS = Array.from({ length: 1000 }, (_, i) => `2.2.2.${i + 1}`);
            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 1000 });
            // Stub the 1st DB call to find existing records. No existing records.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves(EXISTING_IPS.map((ip, i) => ({
                    siteId: SITE_ID,
                    ip,
                    ruleId: Math.floor(i / 19) + 23642,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }))
                )
            });

            const IMPERVA_RULES_RESPONSE_PUT = {
                name: 'Custom IP Block Rule 1734039281612 ',
                action: 'RULE_ACTION_BLOCK'
            };
            // Stub API calls to Imperva to update 100 rules.
            for (let i = 0; i < 100; i++) {
                context.httpRequest.onCall(i + 1).resolves({ data: {
                    ...IMPERVA_RULES_RESPONSE_PUT,
                    rule_id: 23642 + i,
                    name: IMPERVA_RULES_RESPONSE_PUT.name + (i + 1),
                    filter: EXISTING_IPS.slice(i * 19, (i + 1) * 19).concat(NEW_IPS.slice(i, i + 1)).map(ip => `ClientIP == ${ip}`).join(' & ')
                } });
            }
            // Stub 50 API calls to Imperva to create 50 rules. 50x20 = 1000 new IPs.
            for (let i = 100; i < 150; i++) {
                context.httpRequest.onCall(i + 1).resolves({ data: {
                    ...IMPERVA_RULES_RESPONSE_PUT,
                    rule_id: 23642 + i,
                    name: IMPERVA_RULES_RESPONSE_PUT.name + (i + 1),
                    filter: NEW_IPS.slice(i * 20, (i + 1) * 20).map(ip => `ClientIP == ${ip}`).join(' & ')
                } });
            }

            // The payload contains 1000 new IPs.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: NEW_IPS,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.equal(result.error, undefined, 'should not return an error');
            assert.equal(result.processed.length, 1000);

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');
        });
    });

    describe('Errors', () => {

        it('21 new IPs, no previous records, 2nd API call fails', async () => {

            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 20 });
            // Stub the 1st and 2nd DB calls to find existing records is done automatically.

            const IPS = Array.from({ length: 21 }, (_, i) => `1.1.1.${i + 1}`);
            const IMPERVA_RULES_RESPONSE = {
                name: 'Custom IP Block Rule 1734039281344 ',
                action: 'RULE_ACTION_BLOCK'
            };
            // Stub the 1st API call to Imperva to create 20 rules.
            context.httpRequest.onCall(1).resolves({
                data: {
                    ...IMPERVA_RULES_RESPONSE,
                    rule_id: 43642,
                    name: IMPERVA_RULES_RESPONSE.name + '1',
                    filter: IPS.slice(0, 20).map(ip => `ClientIP == ${ip}`).join(' & ')
                }
            });
            // Stub the 2nd API call to Imperva to return an error.
            context.httpRequest.onCall(2).rejects('exceeded amount of allowed rules per site');

            // The payload contains 21 new IPs.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: IPS,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.match(result.error.toString(), /exceeded amount of allowed rules per site/);
            assert.deepEqual(result.processed, IPS.slice(0, 20).map(ip => ({ ruleId: 43642, ip })));

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB with only 20 IPs. Missing the last one.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');
            const insertManyArgsExpected = IPS
                .slice(0, 20)
                .map((ip, i) => ({
                    siteId: SITE_ID,
                    ip,
                    ruleId: 43642,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }));
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0];
            assert.deepEqual(
                insertManyArgs,
                insertManyArgsExpected,
                'should insert the correct records in MongoDB'
            );
            // Expecting 2 calls to create new rules in Imperva.
            assert.equal(context.httpRequest.callCount, 3, 'POST httpRequest should be called twice');
            // First call
            const httpRequestArgs1 = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequestArgs1.url, /v2\/sites\/\d+\/rules$/);
            assert.equal(httpRequestArgs1.method, 'POST');
            assert.equal(httpRequestArgs1.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs1.data.name, /Custom IP Block Rule \d+ 1/);
            assert.equal(httpRequestArgs1.data.action, 'RULE_ACTION_BLOCK');
            assert.match(httpRequestArgs1.data.filter, /ClientIP == 1\.1\.1\.1/);
            assert.match(httpRequestArgs1.data.filter, /ClientIP == 1\.1\.1\.20/);
            // Second call
            const httpRequestArgs2 = context.httpRequest.getCall(2).args[0];
            assert.match(httpRequestArgs2.url, /v2\/sites\/\d+\/rules$/);
            assert.equal(httpRequestArgs2.method, 'POST');
            assert.equal(httpRequestArgs2.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequestArgs2.data.name, /Custom IP Block Rule \d+ 2/);
            assert.equal(httpRequestArgs2.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequestArgs2.data.filter, 'ClientIP == 1\.1\.1\.21');
        });

        it('2 existing rules, 10 new IPs, 2nd API call fails', async () => {

            const EXISTING_IPS = Array.from({ length: 20 }, (_, i) => `1.1.1.${i + 1}`);
            const NEW_IPS = Array.from({ length: 10 }, (_, i) => `2.2.2.${i + 1}`);
            // Stub `insertMany` method of MongoDB collection.
            context.db.collection().insertMany.resolves({ insertedCount: 10 });
            // Stub the 1st DB call to find existing records. No existing records.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves(EXISTING_IPS.map((ip, i) => ({
                    siteId: SITE_ID,
                    ip,
                    ruleId: i < 19 ? 43642 : 43643,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                })))
            });

            const IMPERVA_RULES_RESPONSE_PUT = {
                name: 'Custom IP Block Rule 1734039281612 ',
                action: 'RULE_ACTION_BLOCK'
            };
            // Stub API calls to Imperva to update 2 rules.
            context.httpRequest.onCall(1).resolves({
                data: {
                    ...IMPERVA_RULES_RESPONSE_PUT,
                    rule_id: 43642,
                    name: IMPERVA_RULES_RESPONSE_PUT.name + '1',
                    filter: EXISTING_IPS.slice(0, 19).concat(NEW_IPS.slice(0, 1)).map(ip => `ClientIP == ${ip}`).join(' & ')
                }
            });
            // Stub the 2nd API call to Imperva to return an error.
            context.httpRequest.onCall(2).rejects('exceeded amount of allowed rules per site');

            // The payload contains 1 new IP.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: NEW_IPS,
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };

            // Call the handler with the payload.
            const result = await handler(req);
            assert.match(result.error.toString(), /exceeded amount of allowed rules per site/);
            assert.deepEqual(result.processed, [
                { ruleId: 43642, ip: NEW_IPS[0] }
            ]);

            // Assertions
            // Expecting 2 call to find current rules stored in MongoDB.
            assert.equal(context.db.collection().find.callCount, 2, 'find should be called twice');
            // Expecting 1 call to insert new records in MongoDB.
            assert.equal(context.db.collection().insertMany.callCount, 1, 'insertMany should be called once');

            // Assert MongoDB records.
            const insertManyArgs = context.db.collection().insertMany.getCall(0).args[0];
            assert.equal(insertManyArgs.length, 1, 'should insert only 1 new record in MongoDB');

            // Assert the first new IP in MongoDB.
            assert.deepEqual(insertManyArgs[0], {
                siteId: SITE_ID, removeAfter: AFTER_10_MINUTES, auth: AUTH,
                ip: NEW_IPS[0],
                ruleId: 43642 // The first rule id.
            });

            // Expecting 2 calls to update rules in Imperva.
            // Assert 1st update call.
            assert.equal(context.httpRequest.callCount, 3, 'PUT httpRequest should be called twice');
            const httpRequest1Args = context.httpRequest.getCall(1).args[0];
            assert.match(httpRequest1Args.url, /v2\/sites\/\d+\/rules\/\d+$/);
            assert.equal(httpRequest1Args.method, 'PUT');
            assert.equal(httpRequest1Args.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequest1Args.data.name, /Custom IP Block Rule \d+/);
            assert.equal(httpRequest1Args.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequest1Args.data.filter, EXISTING_IPS.slice(0, 19).concat(NEW_IPS.slice(0, 1)).map(ip => `ClientIP == ${ip}`).join(' & '));
            // Assert 2nd update call.
            const httpRequest2Args = context.httpRequest.getCall(2).args[0];
            assert.match(httpRequest2Args.url, /v2\/sites\/\d+\/rules\/\d+$/);
            assert.equal(httpRequest2Args.method, 'PUT');
            assert.equal(httpRequest2Args.headers['x-API-Key'], AUTH.key);
            assert.match(httpRequest2Args.data.name, /Custom IP Block Rule \d+/);
            assert.equal(httpRequest2Args.data.action, 'RULE_ACTION_BLOCK');
            assert.equal(httpRequest2Args.data.filter, EXISTING_IPS.slice(19).concat(NEW_IPS.slice(1)).map(ip => `ClientIP == ${ip}`).join(' & '));
        });
    });

    describe('Rules cannot be created in Imperva', async () => {

        it('1 new IP, no previous records, 500 rules in Imperva', async () => {
            // Stub the 1st DB call to find existing records. No existing records.
            context.db.collection().find.onCall(0).returns({
                toArray: sinon.stub().resolves([])
            });
            // Stub the 2nd DB call to find all records for the given site.
            context.db.collection().find.onCall(1).returns({
                toArray: sinon.stub().resolves([])
            });

            // Stub API call to Imperva to check the number of existing rules.
            context.httpRequest.onCall(0).resolves({ data: {
                incap_rules: {
                    All: Array.from({ length: 10 }, (_, i) => ({ rule_id: i + 1 }) )
                }
            } });

            // The payload contains 1 new IP.
            const req = {
                payload: {
                    siteId: SITE_ID,
                    ips: ['1.1.1.1'],
                    removeAfter: AFTER_10_MINUTES,
                    auth: AUTH
                }
            };
            // Call the handler with the payload.
            const result = await handler(req);
            assert.match(result.error.toString(), /New rules can not be created. Max number of rules will be exceeded/);
            assert.equal(result.numberOfRules, 500);
            assert.equal(result.maxRules, 500);
        });
    });
});
