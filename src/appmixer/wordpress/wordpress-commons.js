'use strict';
const request = require('request-promise');
const PagingAggregator = require('appmixer-lib').util.PagingAggregator;

const MAXIMUM_PAGING_COUNT = 100;

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
        (accumulator, chunk, offset, count) => accumulator.length < chunk['found'] ?
            offset + chunk[entity].length : -1
    );
};

const blogPostsAggregator = createAggregator('posts', args => {
    return request({
        method: 'GET',
        url: `https://public-api.wordpress.com/rest/v1.1/sites/${args.siteId}` +
            `/posts/?number=${args.count}&offset=${args.offset}`,
        json: true
    });
});

const blogCommentsForPageAggregator = createAggregator('comments', args => {
    return request({
        method: 'GET',
        url: `https://public-api.wordpress.com/rest/v1.1/sites/${args.siteId}` +
            `/posts/${args.postId}/replies/?number=${args.count}&offset=${args.offset}`,
        json: true
    });
});

const blogCommentsAggregator = createAggregator('comments', args => {
    return request({
        method: 'GET',
        url: `https://public-api.wordpress.com/rest/v1.1/sites/${args.siteId}` +
        `/comments/?number=${args.count}&offset=${args.offset}`,
        json: true
    });
});

const siteUsersAggregator = createAggregator('users', args => {
    return request({
        method: 'GET',
        url: `https://public-api.wordpress.com/rest/v1.1/sites/${args.siteId}` +
            `/users/?number=${args.count}&offset=${args.offset}`,
        headers: {
            'authorization': 'Bearer ' + args.auth.accessToken
        },
        json: true
    });
});

module.exports = {

    /**
     * Get blog posts from wordpress.
     * @param {object} args
     * @param {string} args.siteId
     * @returns {*}
     */
    getBlogPosts(args) {

        return blogPostsAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    },

    /**
     * Get list of sites from authenticated user wordpress.
     * @param {string} token
     * @returns {*}
     */
    getUserSites(token) {

        return request({
            method: 'GET',
            url: 'https://public-api.wordpress.com/rest/v1.1/me/sites',
            headers: {
                'authorization': 'Bearer ' + token
            },
            json: true
        });
    },

    /**
     * Get list of posts from site.
     * @param {string} site
     * @returns {*}
     */
    getMatchingPosts(site) {

        return request({
            method: 'GET',
            url: `https://public-api.wordpress.com/rest/v1.1/sites/${site}/posts`,
            json: true
        });
    },

    /**
     * Get list of comments on post.
     * @param {object} args
     * @param {string} args.siteId
     * @param {string} [args.postId] - when not given, comments for all blog posts will be returned
     * @returns {*}
     */
    getBlogComments(args) {

        if (args.postId) {
            return blogCommentsForPageAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
        }
        return blogCommentsAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    },

    /**
     * Create a new post.
     * @param {string} siteId
     * @param {object} postData
     * @param {string} token
     * @returns {*}
     */
    createNewPost(siteId, postData, token) {

        return request({
            method: 'POST',
            url: `https://public-api.wordpress.com/rest/v1.1/sites/${siteId}/posts/new`,
            headers: {
                'authorization': 'Bearer ' + token
            },
            body: postData,
            json: true
        });
    },

    /**
     * Get list of users from site.
     * @param {object} args
     * @returns {*}
     */
    getSiteUsers(args) {

        return siteUsersAggregator.fetch(args, 0, MAXIMUM_PAGING_COUNT);
    }
};
