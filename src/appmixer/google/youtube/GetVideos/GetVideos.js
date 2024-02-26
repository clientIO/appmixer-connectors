'use strict';
const { google } = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

async function getVideos(context) {

    const youtube = google.youtube({
        version: 'v3',
        auth: commons.getAuthLibraryOAuth2Client(context.auth)
    });

    const videosList = promisify(youtube.videos.list.bind(youtube.videos));
    const { data } = await videosList({
        part: 'snippet,contentDetails,player,status,statistics',
        id: context.messages.in.content.videoIds.split(',').map((id) => id.trim()),
    });

    const videos = data.items.map((item) => {
        const {
            id,
            snippet: {
                title,
                description,
                publishedAt: publishDate,
                channelId,
                channelTitle,
                thumbnails: {
                    default: { url: thumbnailDefault }
                },
                localized: { title: caption } = {},
                tags
            },
            contentDetails: { duration, licensedContent },
            player: { embedHtml: embedHTML },
            statistics: { viewCount, likeCount, favoriteCount, commentCount } = {},
            status: { privacyStatus, license, embeddable, publicStatsViewable, madeForKids } = {}
        } = item;

        return {
            videoId: id,
            title,
            description,
            publishDate,
            channelId,
            channelTitle,
            thumbnailDefault,
            duration,
            caption,
            licensedContent,
            embedHTML,
            tags,
            viewCount,
            likeCount,
            favoriteCount,
            commentCount,
            privacyStatus,
            license,
            embeddable,
            publicStatsViewable,
            madeForKids
        };
    });

    return videos || [];
}


module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }
        const videos = await getVideos(context);
        if (videos.length === 0) {
            return context.sendJson(
                {
                    youtubeIds: context.messages.in.content.videoIds
                },
                'notFound'
            );
        }

        if (outputType === 'items') {
            return context.sendJson({ items: videos }, 'out');
        }

        const headers = Object.keys(videos[0]);
        const csvRows = [headers.join(',')];

        for (const video of videos) {
            if (outputType === 'item') {
                await context.sendJson(video, 'out');
            } else {
                const row = Object.values(video).join(',');
                csvRows.push(row);
            }
        }

        if (outputType == 'file') {
            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `youtube-findvideos-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson(savedFile, 'out');
        }
    },
    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    {
                        value: "videoId",
                        label: "Video ID"
                    },
                    {
                        value: "title",
                        label: "Title"
                    },
                    {
                        value: "description",
                        label: "Description"
                    },
                    {
                        value: "publishDate",
                        label: "Publish Date"
                    },
                    {
                        value: "channelId",
                        label: "Channel ID"
                    },
                    {
                        value: "channelTitle",
                        label: "Channel Title"
                    },
                    {
                        value: "thumbnailDefault",
                        label: "Thumbnail Default"
                    },
                    {
                        value: "duration",
                        label: "Duration"
                    },
                    {
                        value: "caption",
                        label: "Caption"
                    },
                    {
                        value: "licensedContent",
                        label: "Licensed Content"
                    },
                    {
                        value: "embedHtml",
                        label: "Embed HTML"
                    },
                    {
                        value: "tags",
                        label: "Tags"
                    },
                    {
                        value: "viewCount",
                        label: "View Count"
                    },
                    {
                        value: "likeCount",
                        label: "Like Count"
                    },
                    {
                        value: "favoriteCount",
                        label: "Favorite Count"
                    },
                    {
                        value: "commentCount",
                        label: "Comment Count"
                    },
                    {
                        value: "privacyStatus",
                        label: "Privacy Status"
                    },
                    {
                        value: "license",
                        label: "License"
                    },
                    {
                        value: "embeddable",
                        label: "Embeddable"
                    },
                    {
                        value: "publicStatsViewable",
                        label: "Public Stats Viewable"
                    },
                    {
                        value: "madeForKids",
                        label: "Made For Kids"
                    }
                ]
                ,
                'out'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Items',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    videoId: {
                                        type: "string",
                                        title: "Video ID"
                                    },
                                    title: {
                                        type: "string",
                                        title: "Title"
                                    },
                                    description: {
                                        type: "string",
                                        title: "Description"
                                    },
                                    publishDate: {
                                        type: "string",
                                        title: "Publish Date"
                                    },
                                    channelId: {
                                        type: "string",
                                        title: "Channel ID"
                                    },
                                    channelTitle: {
                                        type: "string",
                                        title: "Channel Title"
                                    },
                                    thumbnailDefault: {
                                        type: "string",
                                        title: "Thumbnail Default"
                                    },
                                    duration: {
                                        type: "string",
                                        title: "Duration"
                                    },
                                    caption: {
                                        type: "string",
                                        title: "Caption"
                                    },
                                    licensedContent: {
                                        type: "string",
                                        title: "Licensed Content"
                                    },
                                    embedHtml: {
                                        type: "string",
                                        title: "Embed HTML"
                                    },
                                    tags: {
                                        type: "string",
                                        title: "Tags"
                                    },
                                    viewCount: {
                                        type: "string",
                                        title: "View Count"
                                    },
                                    likeCount: {
                                        type: "string",
                                        title: "Like Count"
                                    },
                                    favoriteCount: {
                                        type: "string",
                                        title: "Favorite Count"
                                    },
                                    commentCount: {
                                        type: "string",
                                        title: "Comment Count"
                                    },
                                    privacyStatus: {
                                        type: "string",
                                        title: "Privacy Status"
                                    },
                                    license: {
                                        type: "string",
                                        title: "License"
                                    },
                                    embeddable: {
                                        type: "string",
                                        title: "Embeddable"
                                    },
                                    publicStatsViewable: {
                                        type: "string",
                                        title: "Public Stats Viewable"
                                    },
                                    madeForKids: {
                                        type: "string",
                                        title: "Made For Kids"
                                    }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([
                {
                    label: "File ID",
                    value: "fileId"
                },
                {
                    label: "File Name",
                    value: "filename"
                },
                {
                    label: "Chunk Size",
                    value: "chunkSize"
                },
                {
                    label: "File Length",
                    value: "length"
                }
            ], 'out');
        }
    }
};
