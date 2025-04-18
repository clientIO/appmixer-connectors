const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../utils.js');
const action = require('../../../src/appmixer/trello/list/CreateCard/CreateCard.js');

describe('CreateCard', function() {

    let context;

    beforeEach(function() {

        context = testUtils.createMockContext();
        context.messages = { in: { content: {} } };
        sinon.reset();
    });


    describe('receive', function() {

        beforeEach(function() {

            // Stub httpRequest
            context.httpRequest = sinon.stub().resolves({
                data: {
                    id: 'foo'
                }
            });
        });

        it('should fail with no checklist name', async function() {

            context.messages = {
                in: {
                    content: {
                        name: 'card name',
                        checklistItems: 'a,b,c'
                    }
                }
            };
            await assert.rejects(
                async () => {
                    await action.receive(context);
                },
                context.CancelError('Checklist name is required to add checklist items')
            );
        });

        it('should fail with empty card name', async function() {

            context.messages = { in: { content: { name: '   ' } } };
	        await assert.rejects(
	            async () => {
	                await action.receive(context);
	            },
	            context.CancelError('Card name is required')
	        );

            context.messages = { in: { content: {} } };
	        await assert.rejects(
	            async () => {
	                await action.receive(context);
	            },
	            context.CancelError('Card name is required')
	        );
        });

        it('should fail with too many checklist items', async function() {
            context.messages = {
                in: {
                    content: {
                        name: 'card name',
                        checklistName: 'checklist',
                        checklistItems: '\na\nb\nc\nd\ne\nf\ng\nh\ni\nj\nk'
                    }
                }
            };
            await assert.rejects(
                async () => {
                    await action.receive(context);
                },
                context.CancelError('Maximum 10 checklist items are allowed')
            );
        });

        it('should make 10 API requests for 10 checklist items', async function() {
            context.messages = {
                in: {
                    content: {
                        name: 'card name',
                        boardListId: 'boardListId',
                        checklistName: 'checklist',
                        // Simulating user entering checklist items with leading and trailing newlines
                        checklistItems: '   \na\nb\nc\nd\ne\nf\ng\nh\ni\nj\n  '
                    }
                }
            };

            await action.receive(context);

            assert.strictEqual(context.httpRequest.callCount, 12);
        });
    });
});
