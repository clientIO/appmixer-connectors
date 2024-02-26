'use strict';
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
            url: 'https://api.linkedin.com/v2/posts',
            headers: {
                'X-Restli-Protocol-Version': '2.0.0',
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'LinkedIn-Version': '202304'
            },
            data: buildPost(context)
        });
        return context.sendJson({ status: response.status }, 'out');
    }
};
