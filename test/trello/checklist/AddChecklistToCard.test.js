const assert = require('assert');
const sinon = require('sinon');
const testUtils = require('../../utils.js');
const action = require('../../../src/appmixer/trello/checklist/AddChecklistToCard/AddChecklistToCard.js');

describe('AddChecklistToCard', function() {

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

        describe('checklist items', function() {

            it('should fail with too many checklist items due to leading newline', async function() {
	            context.messages = {
	                in: {
	                    content: {
	                        boardListCardId: 'cardId',
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
                            boardListCardId: 'cardId',
                            checklistName: 'checklist',
                            checklistItems: 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n'
                        }
                    }
                };

                await action.receive(context);

                assert.strictEqual(context.httpRequest.callCount, 11);
            });
        });
    });
});
