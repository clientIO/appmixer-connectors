'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const Each = require('../../Each/Each');

describe('Each Component', () => {

    afterEach(() => {
        sinon.restore();
    });

    describe('Input Handling', () => {

        it('should throw CancelError for invalid JSON string', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: 'not valid json'
                        }
                    }
                },
                properties: {}
            });

            await assert.rejects(
                async () => Each.receive(context),
                (err) => {
                    assert.ok(err instanceof context.CancelError);
                    assert.ok(err.message.includes('Property \'list\' should be array'));
                    return true;
                }
            );
        });

        it('should throw CancelError for negative delay', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: ['a', 'b', 'c'],
                            delay: -5
                        }
                    }
                },
                properties: {}
            });

            await assert.rejects(
                async () => Each.receive(context),
                (err) => {
                    assert.ok(err instanceof context.CancelError);
                    assert.ok(err.message.includes('delay'));
                    return true;
                }
            );

            // Must not have sent anything or scheduled a timeout
            assert.strictEqual(context.sendJson.callCount, 0);
            assert.ok(context.setTimeout.notCalled);
        });

        it('should throw CancelError for non-numeric delay (NaN batch-size guard)', async () => {
            // A transform/lambda can feed a non-numeric delay. It must be rejected, not flow into the
            // delayed path where 180000 / 'foo' = NaN -> empty batches -> infinite timeout loop.
            for (const badDelay of ['foo', {}, NaN]) {
                const context = createMockContext({
                    id: 'test-context-id',
                    messages: { in: { content: { list: ['a', 'b', 'c'], delay: badDelay } } },
                    properties: {}
                });

                await assert.rejects(
                    async () => Each.receive(context),
                    (err) => {
                        assert.ok(err instanceof context.CancelError);
                        assert.ok(err.message.includes('delay'));
                        return true;
                    }
                );
                assert.strictEqual(context.sendJson.callCount, 0);
                assert.ok(context.setTimeout.notCalled);
            }
        });

        it('should treat a numeric-string delay as a number', async () => {
            // '25' must be coerced and routed to the delayed path, not rejected.
            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 100 },  // batch size 4 -> 3 items fit in first batch
                messages: { in: { content: { list: ['a', 'b', 'c'], delay: '25' } } },
                properties: {}
            });
            context.callAppmixer = sinon.stub().resolves({ success: true });

            await Each.receive(context);

            const itemCalls = context.sendJson.getCalls().filter(c => c.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 3);
        });

        it('should send done with count 0 for non-array input', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: { key: 'value' }  // Object, not array
                        }
                    }
                },
                properties: {}
            });

            await Each.receive(context);

            assert.strictEqual(context.sendJson.callCount, 1);
            const doneCall = context.sendJson.getCall(0);
            assert.strictEqual(doneCall.args[0].count, 0);
            assert.strictEqual(doneCall.args[1], 'done');
        });
    });

    describe('Normal Each (no delay)', () => {

        it('should iterate over array and send each item to output', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: ['apple', 'banana', 'cherry']
                        }
                    }
                },
                properties: {}
            });

            await Each.receive(context);

            // Should send 3 items + 1 done message
            assert.strictEqual(context.sendJson.callCount, 4);

            // Check first item
            const firstCall = context.sendJson.getCall(0);
            assert.strictEqual(firstCall.args[0].index, 0);
            assert.strictEqual(firstCall.args[0].value, 'apple');
            assert.strictEqual(firstCall.args[0].count, 3);
            assert.strictEqual(firstCall.args[1], 'item');

            // Check second item
            const secondCall = context.sendJson.getCall(1);
            assert.strictEqual(secondCall.args[0].index, 1);
            assert.strictEqual(secondCall.args[0].value, 'banana');
            assert.strictEqual(secondCall.args[1], 'item');

            // Check third item
            const thirdCall = context.sendJson.getCall(2);
            assert.strictEqual(thirdCall.args[0].index, 2);
            assert.strictEqual(thirdCall.args[0].value, 'cherry');
            assert.strictEqual(thirdCall.args[1], 'item');

            // Check done message
            const doneCall = context.sendJson.getCall(3);
            assert.strictEqual(doneCall.args[0].count, 3);
            assert.ok(doneCall.args[0].correlationId);
            assert.strictEqual(doneCall.args[1], 'done');

            // Should clean up state
            assert.ok(context.stateUnset.calledWith('test-context-id'));
        });

        it('should handle empty array', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: []
                        }
                    }
                },
                properties: {}
            });

            await Each.receive(context);

            // Should send only done message with count 0
            assert.strictEqual(context.sendJson.callCount, 1);
            const doneCall = context.sendJson.getCall(0);
            assert.strictEqual(doneCall.args[0].count, 0);
            assert.strictEqual(doneCall.args[1], 'done');
        });

        it('should handle JSON string as list input', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: '["one", "two"]'
                        }
                    }
                },
                properties: {}
            });

            await Each.receive(context);

            // Should send 2 items + 1 done message
            assert.strictEqual(context.sendJson.callCount, 3);

            const firstCall = context.sendJson.getCall(0);
            assert.strictEqual(firstCall.args[0].value, 'one');
            assert.strictEqual(firstCall.args[1], 'item');
        });

        it('should include correlationId in all items', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: ['a', 'b']
                        }
                    }
                },
                properties: {}
            });

            await Each.receive(context);

            const firstCorrelationId = context.sendJson.getCall(0).args[0].correlationId;
            const secondCorrelationId = context.sendJson.getCall(1).args[0].correlationId;
            const doneCorrelationId = context.sendJson.getCall(2).args[0].correlationId;

            // All should have the same correlationId
            assert.ok(firstCorrelationId);
            assert.strictEqual(firstCorrelationId, secondCorrelationId);
            assert.strictEqual(firstCorrelationId, doneCorrelationId);
        });

        it('should resume from lastSentIndexCache if available', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                messages: {
                    in: {
                        content: {
                            list: ['a', 'b', 'c', 'd', 'e']
                        }
                    }
                },
                properties: {}
            });

            // Simulate a crash recovery - we were at index 3
            context.stateGet = sinon.stub().resolves({ index: 3 });

            await Each.receive(context);

            // Should only send items from index 3 onwards (d, e)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 2);

            // Check that index continues from where we left off
            assert.strictEqual(itemCalls[0].args[0].index, 3);
            assert.strictEqual(itemCalls[0].args[0].value, 'd');
            assert.strictEqual(itemCalls[1].args[0].index, 4);
            assert.strictEqual(itemCalls[1].args[0].value, 'e');

            // Done should still have original count
            const doneCall = context.sendJson.getCalls().find(call => call.args[1] === 'done');
            assert.strictEqual(doneCall.args[0].count, 5);

            // State must be persisted using ABSOLUTE indices (3, 4), not local loop indices (0, 1).
            // Otherwise a second crash would re-send already-processed items.
            const stateSetIndices = context.stateSet.getCalls().map(call => call.args[1].index);
            assert.deepStrictEqual(stateSetIndices, [3, 4]);
        });
    });

    describe('Delayed Each', () => {

        // Use configurable timeoutIntervalMs for fast tests with small batch sizes
        // With timeoutIntervalMs = 10 and delay = 5, batch size = 10/5 = 2 items

        it('should send first batch and schedule timeout when list exceeds batch size', async () => {
            // With timeoutIntervalMs = 10ms and delay = 5ms, batch size = 2 items
            const largeList = ['a', 'b', 'c', 'd', 'e'];
            const delay = 5;

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    in: {
                        content: {
                            list: largeList,
                            delay
                        }
                    }
                },
                properties: {}
            });

            context.callAppmixer = sinon.stub().resolves({ success: true });

            await Each.receive(context);

            // Should send first 2 items (batch size = 2)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 2);

            // Check items are correct
            assert.strictEqual(itemCalls[0].args[0].value, 'a');
            assert.strictEqual(itemCalls[0].args[0].index, 0);
            assert.strictEqual(itemCalls[1].args[0].value, 'b');
            assert.strictEqual(itemCalls[1].args[0].index, 1);

            // Should store list in plugin
            assert.ok(context.callAppmixer.calledOnce);
            const postCall = context.callAppmixer.getCall(0);
            assert.strictEqual(postCall.args[0].method, 'POST');
            assert.strictEqual(postCall.args[0].body.items.length, 5);
            assert.strictEqual(postCall.args[0].body.delay, 5);
            assert.strictEqual(postCall.args[0].body.count, 5);

            // Should store current index in state (now also persists the correlationId for resume)
            assert.ok(context.stateSet.calledWith('test-context-id', sinon.match({ index: 2 })));

            // Should schedule timeout
            assert.ok(context.setTimeout.calledOnce);
            const setTimeoutArg = context.setTimeout.getCall(0).args[0];
            assert.strictEqual(setTimeoutArg.id, 'test-context-id');
            assert.ok(setTimeoutArg.timestamp instanceof Date);
        });

        it('should complete immediately if all items fit in first batch', async () => {
            // With timeoutIntervalMs = 100ms and delay = 5ms, batch size = 20 items
            // 3 items easily fits in one batch
            const smallList = ['a', 'b', 'c'];
            const delay = 5;

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 100 },
                messages: {
                    in: {
                        content: {
                            list: smallList,
                            delay
                        }
                    }
                },
                properties: {}
            });

            context.callAppmixer = sinon.stub().resolves({ success: true });

            await Each.receive(context);

            // Should send all 3 items + done message
            assert.strictEqual(context.sendJson.callCount, 4);

            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 3);

            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 1);
            assert.strictEqual(doneCalls[0].args[0].count, 3);

            // Should NOT call plugin to store (no need since completed)
            assert.ok(context.callAppmixer.notCalled);

            // Should NOT schedule timeout
            assert.ok(context.setTimeout.notCalled);
        });

        it('should process next batch on timeout and complete when done', async () => {
            // With timeoutIntervalMs = 10ms and delay = 5ms, batch size = 2 items
            const delay = 5;
            const storedData = {
                items: ['a', 'b', 'c', 'd', 'e'],
                delay,
                correlationId: 'test-correlation-id',
                count: 5
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // Mock stored state - index 4 means we've sent items 0,1,2,3
            context.stateGet = sinon.stub().resolves({ index: 4 });

            // Mock callAppmixer for GET and DELETE
            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);
            context.callAppmixer.withArgs(sinon.match({ method: 'DELETE' })).resolves({ success: true });

            await Each.receive(context);

            // Should send remaining 1 item (e)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 1);
            assert.strictEqual(itemCalls[0].args[0].value, 'e');
            assert.strictEqual(itemCalls[0].args[0].index, 4);

            // Should send done
            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 1);
            assert.strictEqual(doneCalls[0].args[0].count, 5);
            assert.strictEqual(doneCalls[0].args[0].correlationId, 'test-correlation-id');

            // Should delete stored data
            assert.ok(context.callAppmixer.calledWith(sinon.match({ method: 'DELETE' })));

            // Should clean up state
            assert.ok(context.stateUnset.calledWith('test-context-id'));
        });

        it('should schedule next timeout if more items remain after batch', async () => {
            // With timeoutIntervalMs = 10ms and delay = 5ms, batch size = 2 items
            const delay = 5;
            const storedData = {
                items: ['a', 'b', 'c', 'd', 'e', 'f'],
                delay,
                correlationId: 'test-correlation-id',
                count: 6
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // Starting at index 0
            context.stateGet = sinon.stub().resolves({ index: 0 });

            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);

            await Each.receive(context);

            // Should send batch of 2 items (a, b)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 2);

            // Should NOT send done yet
            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 0);

            // Should update state with new index
            assert.ok(context.stateSet.calledWith('test-context-id', { index: 2 }));

            // Should schedule next timeout
            assert.ok(context.setTimeout.calledOnce);
            const setTimeoutArg2 = context.setTimeout.getCall(0).args[0];
            assert.strictEqual(setTimeoutArg2.id, 'test-context-id');
        });

        it('should return early when storedData is null on timeout', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // callAppmixer returns null (data was deleted)
            context.callAppmixer = sinon.stub().resolves(null);

            await Each.receive(context);

            // Should not send any items or done
            assert.strictEqual(context.sendJson.callCount, 0);
        });

        it('should return early when storedData has no items on timeout', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // callAppmixer returns object without items
            context.callAppmixer = sinon.stub().resolves({ delay: 5, correlationId: 'test' });

            await Each.receive(context);

            // Should not send any items or done
            assert.strictEqual(context.sendJson.callCount, 0);
        });

        it('should clean up and send done when remainingItems is 0 on timeout', async () => {
            const delay = 5;
            const storedData = {
                items: ['a', 'b', 'c'],
                delay,
                correlationId: 'test-correlation-id',
                count: 3
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // Index is at the end - all items already processed
            context.stateGet = sinon.stub().resolves({ index: 3 });

            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);
            context.callAppmixer.withArgs(sinon.match({ method: 'DELETE' })).resolves({ success: true });

            await Each.receive(context);

            // Should NOT send any items (all were already sent)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 0);

            // Should send done with original count
            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 1);
            assert.strictEqual(doneCalls[0].args[0].count, 3);
            assert.strictEqual(doneCalls[0].args[0].correlationId, 'test-correlation-id');

            // Should delete stored data
            assert.ok(context.callAppmixer.calledWith(sinon.match({ method: 'DELETE' })));

            // Should clean up state
            assert.ok(context.stateUnset.calledWith('test-context-id'));
        });

        it('should stop early on first batch if deadline exceeded (time pressure)', async () => {
            // Simulate sendJson being slow: 8ms per call
            // With timeoutIntervalMs = 10ms, SAFETY_MARGIN = 0.85, deadline = 8.5ms
            // After sending first item, time elapsed >= 8.5ms, so loop breaks
            const largeList = Array.from({ length: 10 }, (_, i) => `item-${i}`);
            const delay = 3;

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    in: {
                        content: {
                            list: largeList,
                            delay
                        }
                    }
                },
                properties: {}
            });

            // Stub sendJson to take 8ms (simulating slow network)
            context.sendJson = sinon.stub().callsFake(() =>
                new Promise(resolve => setTimeout(resolve, 8))
            );
            context.callAppmixer = sinon.stub().resolves({ success: true });

            await Each.receive(context);

            // Should only send 1 item (not 3 which is the calculated batch size)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 1);
            assert.strictEqual(itemCalls[0].args[0].value, 'item-0');
            assert.strictEqual(itemCalls[0].args[0].index, 0);

            // Should store list in plugin
            assert.ok(context.callAppmixer.calledOnce);
            const postCall = context.callAppmixer.getCall(0);
            assert.strictEqual(postCall.args[0].method, 'POST');
            assert.strictEqual(postCall.args[0].body.items.length, 10);

            // Should store CORRECT index in state (1, not 3)
            assert.ok(context.stateSet.calledWith('test-context-id', sinon.match({ index: 1 })));

            // Should schedule timeout
            assert.ok(context.setTimeout.calledOnce);
        });

        it('should stop early on continuation batch if deadline exceeded', async () => {
            const delay = 3;
            const storedData = {
                items: Array.from({ length: 10 }, (_, i) => `item-${i}`),
                delay,
                correlationId: 'test-correlation-id',
                count: 10
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // Starting at index 2
            context.stateGet = sinon.stub().resolves({ index: 2 });

            // Stub sendJson to take 8ms
            context.sendJson = sinon.stub().callsFake(() =>
                new Promise(resolve => setTimeout(resolve, 8))
            );
            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);

            await Each.receive(context);

            // Should only send 1 item (index 2)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 1);
            assert.strictEqual(itemCalls[0].args[0].index, 2);
            assert.strictEqual(itemCalls[0].args[0].value, 'item-2');

            // Should update state with CORRECT index (3, not 5 which is batchSize)
            assert.ok(context.stateSet.calledWith('test-context-id', { index: 3 }));

            // Should NOT send done yet (more items remain)
            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 0);

            // Should schedule next timeout
            assert.ok(context.setTimeout.calledOnce);
        });

        it('should handle one item sent when deadline exceeded during first sendJson (no duplicates)', async () => {
            // deadline is ~8.5ms (10 * 0.85). sendJson takes 20ms, so it exceeds deadline during first send.
            // However, sendJson is called, completes, and next check stops further sends.
            // So we get 1 item, not 2+ due to early deadline check on next iteration.
            const delay = 3;
            const storedData = {
                items: Array.from({ length: 10 }, (_, i) => `item-${i}`),
                delay,
                correlationId: 'test-correlation-id',
                count: 10
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 10 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // Starting at index 5
            context.stateGet = sinon.stub().resolves({ index: 5 });

            // Stub sendJson to take 20ms (exceeds deadline)
            context.sendJson = sinon.stub().callsFake(() =>
                new Promise(resolve => setTimeout(resolve, 20))
            );
            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);

            await Each.receive(context);

            // Should send 1 item (first sendJson runs, exceeds deadline, next iteration stops)
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 1);
            assert.strictEqual(itemCalls[0].args[0].index, 5);

            // State should be set with incremented index (6, we sent one item)
            assert.ok(context.stateSet.calledWith('test-context-id', { index: 6 }));

            // Should NOT send done (more items remain)
            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 0);

            // Should schedule next timeout (continue with remaining items)
            assert.ok(context.setTimeout.calledOnce);
        });

        it('should process normal batch when no time pressure (regression test)', async () => {
            // Normal case: sendJson is instant (synchronous stub), no deadline pressure
            // With timeoutIntervalMs = 1000ms and delay = 5ms, batch size = 200 items
            // But deadline = 1000 * 0.85 = 850ms, which is plenty for fast sendJson calls
            const delay = 5;
            const storedData = {
                items: Array.from({ length: 300 }, (_, i) => `item-${i}`),
                delay,
                correlationId: 'test-correlation-id',
                count: 300
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 1000 },
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // Starting at index 0
            context.stateGet = sinon.stub().resolves({ index: 0 });

            // Default sendJson (instant, synchronous)
            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);

            await Each.receive(context);

            // Should send close to batch size (200 items)
            // Due to deadline check overhead, may be 130-170 items depending on system speed
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.ok(itemCalls.length >= 100 && itemCalls.length <= 200, `Expected 100-200 items, got ${itemCalls.length}`);
            assert.strictEqual(itemCalls[0].args[0].index, 0);
            assert.strictEqual(itemCalls[itemCalls.length - 1].args[0].index, itemCalls.length - 1);

            // Should update state with actual sent count
            assert.ok(context.stateSet.calledWith('test-context-id', sinon.match({ index: sinon.match.number })));
            const stateSetCall = context.stateSet.getCall(0);
            assert.ok(stateSetCall.args[1].index === itemCalls.length);

            // Should NOT send done (more items remain)
            const doneCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 0);

            // Should schedule next timeout
            assert.ok(context.setTimeout.calledOnce);
        });

        it('should handle null stateGet on timeout (use index 0)', async () => {
            const delay = 5;
            const storedData = {
                items: ['a', 'b', 'c'],
                delay,
                correlationId: 'test-correlation-id',
                count: 3
            };

            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 100 },  // Large enough for all items
                messages: {
                    timeout: {
                        content: { id: 'test-context-id', timestamp: new Date() }
                    }
                },
                properties: {}
            });

            // stateGet returns null (no cached index)
            context.stateGet = sinon.stub().resolves(null);

            context.callAppmixer = sinon.stub();
            context.callAppmixer.withArgs(sinon.match({ method: 'GET' })).resolves(storedData);
            context.callAppmixer.withArgs(sinon.match({ method: 'DELETE' })).resolves({ success: true });

            await Each.receive(context);

            // Should process all items from index 0
            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 3);
            assert.strictEqual(itemCalls[0].args[0].index, 0);
            assert.strictEqual(itemCalls[0].args[0].value, 'a');
        });
    });

    describe('Engine-retry idempotency & batch-size guard', () => {

        it('should NOT restart from 0 when the store POST throws (engine re-delivers `in`)', async () => {
            // Reproduces the customer's scenario 2: the store request fails after the first batch was
            // already sent. The component is allowed to throw - the engine re-delivers `in` - but on
            // that re-delivery it must resume from the persisted index, NOT restart the loop from 0.
            const id = 'test-context-id';
            const list = ['a', 'b', 'c', 'd', 'e'];
            const eproto = new Error('write EPROTO ... packet length too long');
            eproto.code = 'EPROTO';

            // --- Attempt 1: first batch sent, then POST throws ---
            const ctx1 = createMockContext({
                id,
                config: { timeoutIntervalMs: 10 },  // batch size = 10/5 = 2
                messages: { in: { content: { list, delay: 5 } } },
                properties: {}
            });
            ctx1.callAppmixer = sinon.stub().rejects(eproto);  // POST fails

            await assert.rejects(async () => Each.receive(ctx1), /EPROTO/);

            // Progress (index) was persisted before the throw. The correlationId is derived from the
            // retry-stable context.id, so it does not need to live in state.
            const persisted = ctx1.stateSet.getCalls().map(c => c.args[1]).pop();
            assert.strictEqual(persisted.index, 2);
            const firstBatchItems = ctx1.sendJson.getCalls().filter(c => c.args[1] === 'item');
            assert.strictEqual(firstBatchItems.length, 2);
            const firstCorrelationId = firstBatchItems[0].args[0].correlationId;
            // correlationId is the (retry-stable) context.id, not a generated/random value.
            assert.strictEqual(firstCorrelationId, id);

            // --- Attempt 2: engine re-delivers the SAME `in` message (same context.id); state survives ---
            const ctx2 = createMockContext({
                id,
                config: { timeoutIntervalMs: 10 },
                messages: { in: { content: { list, delay: 5 } } },
                properties: {}
            });
            // Simulate the persisted index surviving across the re-delivery.
            ctx2.stateGet = sinon.stub().resolves(persisted);
            ctx2.callAppmixer = sinon.stub().resolves({ success: true });  // POST now succeeds

            await Each.receive(ctx2);

            const resumedItems = ctx2.sendJson.getCalls().filter(c => c.args[1] === 'item');
            // Resumes at index 2 (c, d) - does NOT re-send a/b from index 0.
            assert.strictEqual(resumedItems.length, 2);
            assert.strictEqual(resumedItems[0].args[0].index, 2);
            assert.strictEqual(resumedItems[0].args[0].value, 'c');
            // Same correlationId as attempt 1 (derived from the stable context.id), so JoinEach pairing
            // stays intact across the re-delivery.
            assert.strictEqual(resumedItems[0].args[0].correlationId, firstCorrelationId);
            assert.ok(ctx2.callAppmixer.calledWith(sinon.match({ method: 'POST' })));
            assert.ok(ctx2.setTimeout.calledOnce);
        });

        it('should not touch the plugin store when all items fit in the first batch', async () => {
            // Small delayed lists complete in the first batch: resume relies on state + the in-message,
            // so no POST/DELETE round-trip to the plugin store should happen.
            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 100 },  // batch size = 20, fits 3 items
                messages: { in: { content: { list: ['a', 'b', 'c'], delay: 5 } } },
                properties: {}
            });
            context.callAppmixer = sinon.stub().resolves({ success: true });

            await Each.receive(context);

            const itemCalls = context.sendJson.getCalls().filter(c => c.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 3);
            assert.ok(context.callAppmixer.notCalled);   // no plugin store used
            assert.ok(context.setTimeout.notCalled);
            assert.ok(context.stateUnset.calledWith('test-context-id'));
            const doneCalls = context.sendJson.getCalls().filter(c => c.args[1] === 'done');
            assert.strictEqual(doneCalls.length, 1);
        });

        it('should send at least one item when timeoutIntervalMs < delay (no infinite empty batch)', async () => {
            // Misconfiguration: interval smaller than delay => floor(interval/delay) === 0.
            // The guard clamps batch size to 1 so the loop always makes progress.
            const context = createMockContext({
                id: 'test-context-id',
                config: { timeoutIntervalMs: 5 },  // floor(5/10) = 0 -> clamped to 1
                messages: {
                    in: { content: { list: ['a', 'b', 'c'], delay: 10 } }
                },
                properties: {}
            });

            context.callAppmixer = sinon.stub().resolves({ success: true });

            await Each.receive(context);

            const itemCalls = context.sendJson.getCalls().filter(call => call.args[1] === 'item');
            assert.strictEqual(itemCalls.length, 1);
            assert.strictEqual(itemCalls[0].args[0].index, 0);
            // Progress persisted and continuation scheduled (not an empty, stuck batch).
            assert.ok(context.stateSet.calledWith('test-context-id', sinon.match({ index: 1 })));
            assert.ok(context.setTimeout.calledOnce);
        });
    });

    describe('buildOutPortOptions', () => {

        it('should return default output options when buildOutPortOptions is true with no input config', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                componentId: 'each-component-1',
                flowDescriptor: {
                    'each-component-1': {
                        config: {
                            transform: {
                                'in': {}
                            }
                        }
                    }
                },
                messages: {},
                properties: {
                    buildOutPortOptions: true
                }
            });

            await Each.receive(context);

            // Should send default output options
            assert.strictEqual(context.sendJson.callCount, 1);
            const call = context.sendJson.getCall(0);
            assert.strictEqual(call.args[1], 'item');

            const options = call.args[0];
            assert.ok(options.some(opt => opt.value === 'index'));
            assert.ok(options.some(opt => opt.value === 'value'));
            assert.ok(options.some(opt => opt.value === 'count'));
            assert.ok(options.some(opt => opt.value === 'correlationId'));
        });

        it('should return default output options when getInputConfig returns null', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                componentId: 'each-component-1',
                flowDescriptor: {
                    'each-component-1': {
                        config: {
                            transform: {
                                'in': {
                                    // Invalid config that will cause getInputConfig to return null
                                    'sender-1': {
                                        'out': null
                                    }
                                }
                            }
                        }
                    }
                },
                messages: {},
                properties: {
                    buildOutPortOptions: true
                }
            });

            await Each.receive(context);

            // Should fall through to default output options
            assert.strictEqual(context.sendJson.callCount, 1);
            const options = context.sendJson.getCall(0).args[0];
            assert.strictEqual(options.length, 4);  // index, value, count, correlationId
        });

        it('should return default output options when inputConfig has modifiers', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                componentId: 'each-component-1',
                flowDescriptor: {
                    'each-component-1': {
                        config: {
                            transform: {
                                'in': {
                                    'sender-1': {
                                        'out': {
                                            modifiers: {
                                                list: {
                                                    'mod-1': {
                                                        variable: 'sender-1.out.items',
                                                        functions: ['someModifier']  // Has modifiers
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                messages: {},
                properties: {
                    buildOutPortOptions: true
                }
            });

            await Each.receive(context);

            // Should return default options when modifiers exist
            assert.strictEqual(context.sendJson.callCount, 1);
            const options = context.sendJson.getCall(0).args[0];
            assert.strictEqual(options.length, 4);
        });

        it('should generate dynamic output options from input variable schema', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                componentId: 'each-component-1',
                flowDescriptor: {
                    'each-component-1': {
                        config: {
                            transform: {
                                'in': {
                                    'sender-1': {
                                        'out': {
                                            modifiers: {
                                                list: {
                                                    'mod-1': {
                                                        // Note: Leading dot in variable format: .componentId.port.path
                                                        variable: '.sender-1.out.items',
                                                        functions: []  // No modifiers
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                messages: {},
                properties: {
                    buildOutPortOptions: true
                }
            });

            // Mock loadOutputSchemaProperties to return schema for the sender component
            // The variable is '.sender-1.out.items', so componentId='sender-1', port='out'
            const schemaProperties = {
                'out': [
                    { path: 'out.items', type: 'array', label: 'Items' },
                    { path: 'out.items.id', type: 'string', label: 'Item ID' },
                    { path: 'out.items.name', type: 'string', label: 'Item Name' },
                    { path: 'out.items.tags', type: 'array', label: 'Tags' },
                    { path: 'out.items.tags.name', type: 'string', label: 'Tag Name' }  // Nested in array
                ]
            };
            context.loadOutputSchemaProperties = sinon.stub().resolves(schemaProperties);

            await Each.receive(context);

            assert.strictEqual(context.sendJson.callCount, 1);
            const options = context.sendJson.getCall(0).args[0];

            // Should include mapped properties + default properties
            assert.ok(options.some(opt => opt.value === 'value.id'), 'Should have value.id');
            assert.ok(options.some(opt => opt.value === 'value.name'), 'Should have value.name');
            // Tags array itself should be included
            assert.ok(options.some(opt => opt.value === 'value.tags'), 'Should have value.tags');
            // But nested tag name should NOT be included (has array parent)
            assert.ok(!options.some(opt => opt.value === 'value.tags.name'), 'Should not have value.tags.name');
            // Default options should be present
            assert.ok(options.some(opt => opt.value === 'index'), 'Should have index');
            assert.ok(options.some(opt => opt.value === 'value'), 'Should have value');
            assert.ok(options.some(opt => opt.value === 'count'), 'Should have count');
            assert.ok(options.some(opt => opt.value === 'correlationId'), 'Should have correlationId');
        });

        it('should use fallback label when property has no label', async () => {
            const context = createMockContext({
                id: 'test-context-id',
                componentId: 'each-component-1',
                flowDescriptor: {
                    'each-component-1': {
                        config: {
                            transform: {
                                'in': {
                                    'sender-1': {
                                        'out': {
                                            modifiers: {
                                                list: {
                                                    'mod-1': {
                                                        // Note: Leading dot in variable format
                                                        variable: '.sender-1.out.items',
                                                        functions: []
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                messages: {},
                properties: {
                    buildOutPortOptions: true
                }
            });

            // Property without label should use fallback
            const schemaProperties = {
                'out': [
                    { path: 'out.items', type: 'array', label: 'Items' },
                    { path: 'out.items.foo', type: 'string' }  // No label
                ]
            };
            context.loadOutputSchemaProperties = sinon.stub().resolves(schemaProperties);

            await Each.receive(context);

            const options = context.sendJson.getCall(0).args[0];
            // Should use fallback label 'item.foo'
            assert.ok(options.some(opt => opt.label === 'item.foo' && opt.value === 'value.foo'));
        });
    });
});
