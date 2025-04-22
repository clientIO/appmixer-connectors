const assert = require('assert');
const action = require('../../../src/appmixer/freshdesk/tickets/ListTickets/ListTickets.js');

describe('ListTickets', function() {

    describe('Filters', function() {

        describe('getQuery', async function() {

            it('due_by', async function() {

                const filters = {
                    OR: [{
                        AND: [
                            {
                                dueByOperator: '=',
                                field: 'dueBy',
                                dueByValue: '2024-08-23T12:00:00.000Z'
                            }
                        ]
                    }]
                };

                const result = action.getQuery(filters);
                assert.equal(result, '"((due_by:\'2024-08-23\'))"');
            });

            it('fr_due_by', async function() {

                const filters = {
                    OR: [{
                        AND: [
                            {
                                frDueByOperator: '<',
                                field: 'frDueBy',
                                frDueByValue: '2024-08-15T12:00:00.000Z'
                            }
                        ]
                    }]
                };

                const result = action.getQuery(filters);
                assert.equal(result, '"((fr_due_by:<\'2024-08-15\'))"');
            });

            it('created_at AND updated_at', async function() {

                const filters = {
                    OR: [{
                        AND: [
                            {
                                createdAtOperator: '>',
                                field: 'createdAt',
                                createdAtValue: '2024-08-25T12:00:00.000Z'
                            },
                            {
                                updatedAtOperator: '>',
                                field: 'updatedAt',
                                updatedAtValue: '2024-08-25T12:00:00.000Z'
                            }
                        ]
                    }]
                };

                const result = action.getQuery(filters);
                assert.equal(result, '"((created_at:>\'2024-08-25\' AND updated_at:>\'2024-08-25\'))"');
            });

            it('(status AND tag) OR priority', async function() {

                const filters = {
                    OR: [
                        {
                            AND: [
                                {
                                    status: 2,
                                    field: 'status'
                                },
                                {
                                    tag: 'foo',
                                    field: 'tag'
                                }
                            ]
                        },
                        {
                            AND: [
                                {
                                    priorityOperator: '=',
                                    field: 'priority',
                                    priorityValue: 3
                                }
                            ]
                        }
                    ]
                };

                const result = action.getQuery(filters);
                assert.equal(result, '"((status:2 AND tag:\'foo\') OR (priority:3))"');
            });
        });
    });
});
