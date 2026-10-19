'use strict';

const { API_BASE_URL, getHeaders, escapeLittleText } = require('../../lib');

const ORGANIZATION_ID_PATTERN = /^(?:urn:li:organization:)?(\d+)$/;
// Formats accepted by the LinkedIn Images API.
const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif)$/i;

/**
 * Upload an image from Appmixer storage to LinkedIn and return its URN.
 * https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
 * @param {Context} context
 * @param {string} fileId Appmixer file ID
 * @param {string} ownerUrn Organization URN that will own the image
 * @returns {Promise<string>} Image URN, e.g. urn:li:image:C4E10AQ...
 */
async function uploadImage(context, fileId, ownerUrn) {

    const fileInfo = await context.getFileInfo(fileId);
    if (!fileInfo) {
        throw new context.CancelError(`Image file '${fileId}' was not found.`);
    }
    const contentType = String(fileInfo.contentType || '').toLowerCase();
    if (!IMAGE_CONTENT_TYPES.includes(contentType) && !IMAGE_EXTENSION_PATTERN.test(fileInfo.filename || '')) {
        throw new context.CancelError(
            `Image file '${fileInfo.filename || fileId}' must be a JPG, PNG or GIF image` +
            (contentType ? `, got ${contentType}.` : '.')
        );
    }

    const { data } = await context.httpRequest({
        method: 'POST',
        url: `${API_BASE_URL}/rest/images?action=initializeUpload`,
        headers: {
            ...getHeaders(context),
            'Content-Type': 'application/json'
        },
        data: { initializeUploadRequest: { owner: ownerUrn } }
    });
    const { uploadUrl, image } = (data && data.value) || {};
    if (!uploadUrl || !image) {
        throw new Error('LinkedIn did not return an upload URL for the image.');
    }

    // The upload request carries the account token, so it must stay on LinkedIn.
    const { protocol, hostname } = new URL(uploadUrl);
    if (protocol !== 'https:' || !(hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com'))) {
        throw new Error(`LinkedIn returned an unexpected image upload host: ${hostname}.`);
    }

    const stream = await context.getFileReadStream(fileId);
    await context.httpRequest({
        method: 'PUT',
        url: uploadUrl,
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'Content-Type': 'application/octet-stream',
            ...(fileInfo.length ? { 'Content-Length': fileInfo.length } : {})
        },
        data: stream,
        maxBodyLength: Infinity
    });

    return image;
}

/**
 * Build the LinkedIn post payload for an organization author.
 * @param {Context} context
 * @param {string} authorUrn Full URN of the organization, e.g. urn:li:organization:12345
 * @param {string} [imageUrn] URN of an uploaded image to attach
 * @returns {Object} Post payload
 */
function buildPost(context, authorUrn, imageUrn) {

    const {
        visibility, text, allowMentions, url, title, description, specificLink, altText
    } = context.messages.in.content;

    const shareObject = {
        author: authorUrn,
        // Plain text is escaped; with allowMentions the text is sent as LinkedIn "little text".
        commentary: allowMentions ? text : escapeLittleText(text),
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
    } else if (imageUrn) {

        shareObject.content = {
            media: {
                id: imageUrn,
                ...(altText ? { altText } : {})
            }
        };
    }

    return shareObject;
}

/**
 * Create a LinkedIn post as a company page (organization).
 */
module.exports = {

    async receive(context) {

        const { organizationId, text, specificLink, url, title, imageFileId } = context.messages.in.content;

        if (!organizationId) {
            throw new context.CancelError('Organization ID is required!');
        }
        if (!text) {
            throw new context.CancelError('Text is required!');
        }
        if (specificLink && !url) {
            throw new context.CancelError('URL is required when sharing a specific link!');
        }
        if (specificLink && !title) {
            throw new context.CancelError('Title is required when sharing a specific link!');
        }
        if (specificLink && imageFileId) {
            throw new context.CancelError('A post can have either a shared link or an image, not both.');
        }

        // Accept both the numeric ID ("12345") and the full URN ("urn:li:organization:12345").
        const match = String(organizationId).trim().match(ORGANIZATION_ID_PATTERN);
        if (!match) {
            throw new context.CancelError(
                `Invalid organization ID '${organizationId}'. ` +
                'Use the numeric ID (e.g. 12345) or the URN (e.g. urn:li:organization:12345).'
            );
        }
        const orgId = match[1];
        const authorUrn = `urn:li:organization:${orgId}`;

        let response;
        try {
            // Inside the try: initializeUpload also needs w_organization_social and the page role.
            const imageUrn = imageFileId ? await uploadImage(context, imageFileId, authorUrn) : undefined;
            response = await context.httpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/rest/posts`,
                headers: {
                    ...getHeaders(context),
                    'Content-Type': 'application/json'
                },
                data: buildPost(context, authorUrn, imageUrn)
            });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                const detail = err.response.data && err.response.data.message;
                throw new context.CancelError(
                    `LinkedIn rejected the post for organization ${orgId} (403 Forbidden). ` +
                    'Make sure you are an administrator or content administrator of the page and the account ' +
                    'has granted the w_organization_social permission.' +
                    (detail ? ` LinkedIn says: ${detail}` : '')
                );
            }
            throw err;
        }

        return context.sendJson({
            status: response.status,
            postId: response.headers['x-restli-id']
        }, 'out');
    }
};
