'use strict';
const ApiDriver = require('appmixer-lib').apiDriver;
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;

// Setup mailchimp driver (wrapper for http APIs)
let mailchimpDriver = new ApiDriver({
    baseUrl: '',
    routesConfiguration: __dirname + '/mailchimp-routes-conf.json'
});

const SUBSCRIBER_STATUS = {
    subscribed: 'subscribed',
    unsubscribed: 'unsubscribed',
    cleaned: 'cleaned',
    pending: 'pending'
};

const MAXIMUM_PAGING_COUNT = 1000;

/**
 * To reduce boilerplate, this function creates page aggregator.
 * @param {string} entity - posts | users | ...
 * @param {function} fetchFunction
 * @return {PagingAggregator}
 */
const createAggregator = function(entity, fetchFunction) {

    return new PagingAggregator(
        // fetch function
        (args, offset, count) => {

            args.offset = offset;
            args.count = count;

            return fetchFunction(args);
        },
        // aggregation function
        (accumulator, chunk, offset, count) => accumulator.concat(chunk[entity]),
        // next offset function
        (accumulator, chunk, offset, count) => accumulator.length < chunk['total_items'] ?
            offset + count : -1
    );
};

const membersAggregator = createAggregator('members', args => {

    return mailchimpDriver.lists.members({
        dc: args.dc,
        auth: { accessToken: args.accessToken },
        count: args.count,
        offset: args.offset,
        listId: args.listId,
        qs: args.qs || {}
    });
});

const campaignsAggregator = createAggregator('campaigns', args => {

    return mailchimpDriver.campaigns.campaigns({
        dc: args.dc,
        auth: { accessToken: args.accessToken },
        count: args.count,
        offset: args.offset,
        qs: args.qs || {}
    });
});

const listsAggregator = createAggregator('lists', args => {

    return mailchimpDriver.lists.lists({
        dc: args.dc,
        auth: { accessToken: args.accessToken },
        count: args.count,
        offset: args.offset,
        qs: args.qs || {}
    });
});

const filesAggregator = createAggregator('files', args => {

    return mailchimpDriver.fileManager.files({
        dc: args.dc,
        auth: { accessToken: args.accessToken },
        count: args.count,
        offset: args.offset,
        qs: args.qs || {}
    });
});

module.exports = {

    MAXIMUM_PAGING_COUNT,

    SUBSCRIBER_STATUS,

    getServerId(apiKey) {

        return apiKey.split('-')[1];
    },

    getMailchimpDriver() {

        return mailchimpDriver;
    },

    /**
     * Recursively get all the members of a mailchimp list. Mailchimp uses pagination for
     * the API, by default it's set to get 1000 lists at a time.
     * @param {Object} args
     * @param {string} args.dc
     * @param {string} args.accessToken
     * @param {string} args.listId
     * @param {string} [args.since]
     * @return {Promise<{members:[]}>}
     */
    getMembers(args) {

        return membersAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    },

    /**
     * Recursively get all the campaigns of a mailchimp. Mailchimp uses pagination for
     * the API, by default it's set to get 1000 lists at a time.
     * @param {Object} args
     * @param {string} args.dc
     * @param {string} args.accessToken
     * @param {string} args.since
     * @return {Promise<{campaigns:[]}>}
     */
    getCampaigns(args) {

        return campaignsAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    },

    /**
     * Recursively get all the users mailchimp lists. Mailchimp uses pagination for
     * the API, by default it's set to get 1000 lists at a time, which should be enough
     * for all users, but if not, here's a recursive alg that will get all the lists.
     * @param {Object} args
     * @param {string} args.dc
     * @param {string} args.accessToken
     * @param {string} args.since
     * @return {Promise<{lists:[]}>}
     */
    getLists(args) {

        return listsAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    },

    /**
     * Recursively get all the users mailchimp files. Mailchimp uses pagination for
     * the API, by default it's set to get 1000 lists at a time, which should be enough
     * for all users, but if not, here's a recursive alg that will get all the files.
     * @param {Object} args
     * @param {string} args.dc
     * @param {string} args.accessToken
     * @param {string} args.since
     * @return {Promise<{files:[]}>}
     */
    getFiles(args) {

        return filesAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    }
};
