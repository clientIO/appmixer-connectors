'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;

const aggregator = new PagingAggregator(
    (args, page, pageSize) => {
        args.options.variables.page = page;
        args.options.variables.limit = pageSize;
        return commons.makeRequest(args);
    },
    (accumulator, chunk) => {
        return accumulator.concat(chunk.boards);
    },
    (accumulator, chunk, page, pageSize) => {
        const isDone = !chunk.boards.length || chunk.boards.length < pageSize;
        return isDone ? -1 : page + 1;
    }
);

/**
 * Component for fetching list of boards.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let boards = await context.staticCache.get(context.auth.apiKey + '_boards');
        if (boards) {
            return context.sendJson({ boards }, 'out');
        }

        const options = {
            query: queries.listBoards,
            options: {
                variables: {
                    page: 1,
                    limit: 50
                }
            },
            apiKey: context.auth.apiKey
        };
        boards = await aggregator.fetch(options, 1, 50);

        await context.staticCache.set(
            context.auth.apiKey + '_boards',
            boards,
            context.config.listBoardsCacheTTL || 20 * 1000
        );

        return context.sendJson({ boards }, 'out');
    },

    boardsToSelectArray({ boards }) {

        return boards.map(board => {
            return { label: board.name, value: board.id };
        });
    }
};

