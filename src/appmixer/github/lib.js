'use strict';
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

    async callEndpoint(context, action, {
        method = 'GET',
        data = {},
        params
    } = {}) {

        const url = `https://api.github.com/${action}`;
        console.log(url, data);
        const options = {
            method,
            url,
            headers: {
                'X-GitHub-Api-Version': '2022-11-28',
                'Authorization': `Bearer ${context.accessToken || context.auth?.accessToken}`
            },
            data,
            params
        };

        return await context.httpRequest(options);
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
