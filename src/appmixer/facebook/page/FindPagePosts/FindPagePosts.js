'use strict';

const lib = require('../../lib');

const DEFAULT_MAX_RESULTS = 100;
// Each 100 posts is one request against the 200 requests/hour quota.
const MAX_RESULTS_CAP = 1000;

const POST_FIELDS = [
    'id',
    'message',
    'story',
    'created_time',
    'updated_time',
    'permalink_url',
    'full_picture',
    'status_type',
    'is_published',
    'attachments{type,url,title,description,media,subattachments{type,url,media}}'
].join(',');

// The output contract of one post. A dynamic (source) output port has no `schema` in
// component.json, so the schema is exported as ITEM_SCHEMA for the offline tooling.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'created_time', 'pageId'],
    properties: {
        id: { type: 'string', title: 'Post ID', example: '104857361234567_987654321098765' },
        message: { type: 'string', title: 'Message', example: 'We are hiring! Join our engineering team.' },
        story: { type: 'string', title: 'Story', example: 'Acme Inc updated their cover photo.' },
        created_time: { type: 'string', title: 'Created Time', example: '2026-09-10T08:30:00+0000' },
        updated_time: { type: 'string', title: 'Updated Time', example: '2026-09-10T09:12:44+0000' },
        permalink_url: {
            type: 'string',
            title: 'Permalink URL',
            example: 'https://www.facebook.com/104857361234567/posts/987654321098765'
        },
        full_picture: {
            type: 'string',
            title: 'Picture URL',
            example: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/123456789_n.jpg'
        },
        status_type: { type: 'string', title: 'Status Type', example: 'added_photos' },
        is_published: { type: 'boolean', title: 'Is Published', example: true },
        attachments: {
            type: 'array',
            title: 'Attachments',
            example: [{
                type: 'album',
                url: 'https://www.facebook.com/photo.php?fbid=122133547148947080',
                title: 'Photos from Acme Inc\'s post',
                imageUrl: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/123456789_n.jpg',
                subattachments: [{
                    type: 'photo',
                    url: 'https://www.facebook.com/photo.php?fbid=122133547148947081',
                    imageUrl: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/123456790_n.jpg'
                }]
            }],
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', title: 'Attachments.Type', example: 'photo' },
                    url: {
                        type: 'string',
                        title: 'Attachments.URL',
                        example: 'https://www.facebook.com/photo.php?fbid=122133547148947080'
                    },
                    title: { type: 'string', title: 'Attachments.Title', example: 'Summer sale' },
                    description: { type: 'string', title: 'Attachments.Description', example: '20% off all drinks' },
                    imageUrl: {
                        type: 'string',
                        title: 'Attachments.Image URL',
                        example: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/123456789_n.jpg'
                    },
                    videoUrl: {
                        type: 'string',
                        title: 'Attachments.Video URL',
                        example: 'https://video.xx.fbcdn.net/v/t42.1790-2/123456789_n.mp4'
                    },
                    subattachments: {
                        type: 'array',
                        title: 'Attachments.Subattachments',
                        example: [{
                            type: 'photo',
                            url: 'https://www.facebook.com/photo.php?fbid=122133547148947081',
                            imageUrl: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/123456790_n.jpg'
                        }]
                    }
                }
            }
        },
        pageId: { type: 'string', title: 'Page ID', example: '104857361234567' },
        pageName: { type: 'string', title: 'Page Name', example: 'Acme Inc' }
    }
};

/**
 * @param {*} value date input
 * @param {string} label input label used in the error message
 * @returns {number|undefined} unix timestamp in seconds
 */
const toUnixTime = (context, value, label) => {

    if (!value) {
        return undefined;
    }

    const time = new Date(value).getTime();
    if (Number.isNaN(time)) {
        throw new context.CancelError(`${label} is not a valid date: ${value}`);
    }

    return Math.floor(time / 1000);
};

/**
 * Flatten one Graph API attachment: drop the `{ data: [...] }` envelopes and the nested
 * media object, so the variable picker can offer plain fields.
 */
const mapAttachment = (attachment) => {

    const mapped = {
        type: attachment.type,
        url: attachment.url,
        title: attachment.title,
        description: attachment.description,
        imageUrl: attachment.media?.image?.src,
        videoUrl: attachment.media?.source
    };

    if (attachment.subattachments) {
        mapped.subattachments = (attachment.subattachments.data || []).map(mapAttachment);
    }

    return mapped;
};

/**
 * @param {*} value
 * @returns {number} requested count clamped to 1..MAX_RESULTS_CAP
 */
const toMaxResults = (value) => {

    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return DEFAULT_MAX_RESULTS;
    }

    return Math.min(parsed, MAX_RESULTS_CAP);
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            pageId,
            since,
            until,
            maxResults,
            outputType = 'array'
        } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Posts' });
        }

        if (!pageId) {
            throw new context.CancelError('Page is required!');
        }

        const params = { fields: POST_FIELDS };
        const sinceTime = toUnixTime(context, since, 'Since');
        const untilTime = toUnixTime(context, until, 'Until');
        if (sinceTime !== undefined) params.since = sinceTime;
        if (untilTime !== undefined) params.until = untilTime;

        const { client, pageDetails } = await lib.getPageClient(context, pageId);
        const posts = await client.fetchUpTo(`/${pageId}/posts`, params, toMaxResults(maxResults));

        if (!posts.length) {
            return context.sendJson({ pageId, since: since || null, until: until || null }, 'notFound');
        }

        const records = posts.map(post => ({
            ...post,
            attachments: (post.attachments?.data || []).map(mapAttachment),
            pageId,
            pageName: pageDetails.name
        }));

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
