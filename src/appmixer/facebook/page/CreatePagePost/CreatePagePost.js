'use strict';

const FormData = require('form-data');
const { getPageClient } = require('../../lib');

// Every photo is one upload request against the 200 requests/hour quota.
const MAX_IMAGES = 10;

/**
 * Upload one photo to the page as unpublished, so it can be attached to the post.
 * @returns {Promise<string>} photo ID
 */
async function uploadPhoto(context, client, pageId, image, temporary) {

    if (!image.fileId) {
        const result = await client.post(`/${pageId}/photos`, { url: image.url, published: false, temporary });
        return result.id;
    }

    const fileInfo = await context.getFileInfo(image.fileId);
    const stream = await context.getFileReadStream(image.fileId);
    const form = new FormData();
    form.append('published', 'false');
    form.append('temporary', String(temporary));
    form.append('source', stream, {
        filename: fileInfo.filename,
        contentType: fileInfo.contentType,
        knownLength: fileInfo.length
    });

    try {
        const result = await client.postForm(`/${pageId}/photos`, form);
        return result.id;
    } catch (err) {
        // A failed upload leaves the file stream open, one descriptor per attempt.
        stream.destroy();
        throw err;
    }
}

/**
 * Create a post on a Facebook page.
 */
module.exports = {

    async receive(context) {

        const input = context.messages.content.content;
        const { pageId, images } = input;

        const imageList = (images?.ADD || []).filter(image => image && (image.fileId || image.url));

        if (!pageId) {
            throw new context.CancelError('Page is required!');
        }
        if (!input.message && !input.link && !imageList.length) {
            throw new context.CancelError('Message, Link URL or Images is required!');
        }
        if (input.link && imageList.length) {
            throw new context.CancelError('Link URL cannot be combined with Images. Put the link into the Message instead.');
        }
        if (imageList.length > MAX_IMAGES) {
            throw new context.CancelError(`At most ${MAX_IMAGES} images can be attached to one post.`);
        }

        const { client, pageDetails } = await getPageClient(context, pageId);

        const postData = { ...input };
        delete postData.pageId;
        delete postData.images;

        if (postData.scheduled_publish_time) {
            const now = Math.floor(Date.now() / 1000);
            let timestamp = Math.floor(new Date(postData.scheduled_publish_time).getTime() / 1000);

            // Scheduled time must be at least 10 minutes from now
            if (timestamp < (now + 630)) {
                timestamp = now + 630;
            }

            postData.scheduled_publish_time = timestamp;
            postData.published = false;
        }

        // Photos of a scheduled post must be uploaded as temporary.
        const temporary = Boolean(postData.scheduled_publish_time);
        const photoIds = [];
        for (const image of imageList) {
            photoIds.push(await uploadPhoto(context, client, pageId, image, temporary));
        }
        if (photoIds.length) {
            postData.attached_media = photoIds.map(id => ({ media_fbid: id }));
        }

        const result = await client.post(`/${pageId}/feed`, postData);

        return context.sendJson({
            id: result.id,
            message: postData.message,
            link: postData.link,
            photoIds,
            pageId,
            pageName: pageDetails.name
        }, 'newPost');
    }
};
