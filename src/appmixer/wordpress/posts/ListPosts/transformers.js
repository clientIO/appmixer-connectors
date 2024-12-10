'use strict';

/**
 * Transformer for posts in account
 * @param {Object|string} posts
 */
module.exports.postsToSelectArray = posts => {
    let transformed = [];

    if (Array.isArray(posts)) {
        posts.forEach(post => {
            const label = post['title'] ? post['title'] : post['URL'];
            transformed.push({
                label,
                value: post['ID']
            });
        });
    }

    return transformed;
};
