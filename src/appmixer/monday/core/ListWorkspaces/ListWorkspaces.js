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
        return accumulator.concat(chunk.workspaces);
    },
    (accumulator, chunk, page, pageSize) => {
        const isDone = !chunk.workspaces.length || chunk.workspaces.length < pageSize;
        return isDone ? -1 : page + 1;
    }
);
/**
 * Component for fetching list of workspaces.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const options = {
            query: queries.listWorkspaces,
            options: {
                variables: {
                    page: 1,
                    limit: 50
                }
            },
            apiKey: context.auth.apiKey
        };
        const workspaces = await aggregator.fetch(options, 1, 50);
        return context.sendJson({ workspaces }, 'out');
    },

    workspacesToSelectArray({ workspaces }) {

        return workspaces.map(workspace => {
            return { label: workspace.name, value: workspace.id };
        });
    }
};

