'use strict';

/**
 * Transformer for list of pullRequests
 * @param {Object|string} pullRequests
 */
module.exports.pullRequestsToSelectArray = pullRequests => {

    let transformed = [];

    if (Array.isArray(pullRequests)) {
        pullRequests.forEach(pullRequest => {

            transformed.push({
                label: pullRequest['title'],
                value: pullRequest['id']
            });
        });
    }

    return transformed;
};
