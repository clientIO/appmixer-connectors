'use strict';

/**
 * Transformer for posts in account
 * @param {Object|string} posts
 */
module.exports.postsToSelectArray = posts => {

    let transformed = [];

    if (Array.isArray(posts)) {
        posts.forEach(post => {

            transformed.push({
                label: post['URL'],
                value: post['ID']
            });
        });
    }

    return transformed;
};
