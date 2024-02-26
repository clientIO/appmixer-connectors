'use strict';
const { Octokit } = require('@octokit/rest');
const repoReg = /[^\/]+/g;


module.exports = {

    /**
     * Get new GithubAPI
     * @param {string} token
     * @returns {*} github
     */
    getGithubAPI(token) {

        return new Octokit({
            auth: token,
            debug: false,
            protocol: 'https',
            host: 'api.github.com',
            userAgent: 'AppMixer',
            Promise: require('bluebird'),
            followRedirects: false,
            request: {
                timeout: 15000
            }
        });
    },

    /**
     * Build options.
     * @param {string} repoId
     * @param {Object} req
     * @returns {*} github
     */
    buildUserRepoRequest(repoId, req = {}) {

        let [owner, repo] = repoId.match(repoReg);
        Object.assign(req, { owner, repo });

        return req;
    },

    /**
     * Get all records.
     * @param github
     * @param {string} entity - repos, ...
     * @param {string} func - getAll, ...
     * @param {*} [params]
     * @return {Promise<*>}
     */
    getAll(github, entity, func, params = null) {

        let options = github[entity][func]['endpoint'].merge(params);
        return github.paginate(options);
    },

    /**
     * Process items to find newly added.
     * @param {Set} knownItems
     * @param {Set} actualItems
     * @param {Set} newItems
     * @param {String} key
     * @param {Object} item
     */
    processItems(knownItems, actualItems, newItems, key, item) {

        if (knownItems && !knownItems.has(item[key])) {
            newItems.add(item);
        }
        actualItems.add(item[key]);
    }
};
