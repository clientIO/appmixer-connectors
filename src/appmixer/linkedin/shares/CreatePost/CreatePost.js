'use strict';

const { BASE_URL, VERSION_PATH, VERSION_HEADER } = require('../../constants');

/**
 * Build post.
 * @param {Context} context
 * @param {Object} post
 * @return {Object} shareObject
 */
function buildPost(context) {

    const { visibility, text, url, title, description, specificLink } = context.messages.in.content;

    const shareObject = {
        author: `urn:li:person:${context.auth.profileInfo.sub}`,
        commentary: text,
        visibility: visibility || 'PUBLIC',
        distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: []
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
    };

    if (specificLink) {

        shareObject.content = {
            article: {
                source: url,
                title,
                description
            }
        };
    }

    return shareObject;
}

/**
 * Component for sharing a post
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const response = await context.httpRequest({
            method: 'POST',
            url: `${BASE_URL}${VERSION_PATH}/posts`,
            headers: {
                'X-Restli-Protocol-Version': '2.0.0',
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json'
            },
            data: buildPost(context)
        });
        return context.sendJson({ status: response.status, postId: response.headers['x-restli-id'] }, 'out');
    }
};
