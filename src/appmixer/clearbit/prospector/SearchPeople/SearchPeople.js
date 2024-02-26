'use strict';
const commons = require('../../clearbit-commons');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;
const Promise = require('bluebird');

const aggregator = new PagingAggregator(
    (args, page, pageSize) => {
        return args.api.search(Object.assign({}, args.attributes, {
            page: page,
            page_size: pageSize
        }));
    },
    (accumulator, chunk) => {
        return accumulator.concat(chunk['results']);
    },
    (accumulator, chunk, page, pageSize) => {
        return (page - 1) * pageSize + chunk['results'].length >= chunk['total'] ? -1 : page + 1
    }
);


module.exports = {

    async receive(context) {

        let { apiKey } = context.auth;
        let client = commons.getClearbitAPI({ key: apiKey });
        let attributes = context.messages.attributes.content;

        let persons = await aggregator.fetch(
            { api: client.Prospector, attributes: attributes },
            1,
            20  // 20 is max page_size (https://dashboard.clearbit.com/docs?#prospector-api-person-search)
        );

        return Promise.map(persons, person => {
            return context.sendJson(person, 'person');
        });
    }
};

