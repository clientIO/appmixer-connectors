'use strict';
const aggregators = require('../../aggregators');
const mailchimpDriver = require('../../commons');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;

const MAXIMUM_PAGING_COUNT = aggregators.MAXIMUM_PAGING_COUNT;

const aggregator = new PagingAggregator(
    // fetch function
    (args, offset, count) => {

        args.offset = offset;
        args.count = count;
        return mailchimpDriver.lists.getMergeFields(args.context, args);
    },
    // aggregation function
    (accumulator, chunk, offset, count) => accumulator.concat(chunk['merge_fields']),
    // next offset function
    (accumulator, chunk, offset, count) => accumulator.length < chunk['total_items'] ?
        offset + chunk['merge_fields'].length : -1
);

/**
 * Component listing subscribers
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { listId } = context.properties;
        return aggregator.fetch(
            {
                context,
                listId
            }, 0, MAXIMUM_PAGING_COUNT)
            .then(response => {
                return context.sendJson(response, 'out');
            });
    }
};
