'use strict';
const { google } = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

async function searchYoutubeVideos(context, params) {

    const youtube = google.youtube({
        version: 'v3',
        auth: commons.getAuthLibraryOAuth2Client(context.auth)
    });

    const listSearchResults = promisify(youtube.search.list).bind(youtube.search);

    const { data } = await listSearchResults({
        part: 'id,snippet',
        q: params.searchTerm,
        type: 'video',
        safeSearch: params.safeSearch,
        videoEmbeddable: params.videoEmbeddable,
        channelId: params.channelId,
        maxResults: Math.min(params.limit, 50),
        pageToken: params.pageToken
    });

    const videos = data.items.map((item) => {
        const { id, snippet } = item;
        const {
            channelId, channelTitle, description, publishedAt, thumbnails: {
                default: { url: thumbnailDefault },
                medium: { url: thumbnailMedium },
                high: { url: thumbnailHigh }
            }, title
        } = snippet;

        return {
            videoId: id.videoId,
            channelId,
            channelTitle,
            description,
            publishedAt,
            thumbnailDefault,
            thumbnailMedium,
            thumbnailHigh,
            title
        };
    });

    return { nextPageToken: data.nextPageToken, items: videos };
}

async function getPaginatedResults(context, params) {

    let videos = [];
    let { nextPageToken, items } = await searchYoutubeVideos(context, params);
    videos = videos.concat(items);

    while (nextPageToken && videos.length < params.limit) {
        params.pageToken = nextPageToken;
        const response = await searchYoutubeVideos(context, params);
        nextPageToken = response.nextPageToken;
        videos = videos.concat(response.items);
    }

    return videos;
}

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const videos = await getPaginatedResults(context, context.messages.in.content);

        if (videos.length === 0) {
            return context.sendJson({
                youtubeSearchTerm: context.messages.in.content.searchTerm
            }, 'notFound');
        }

        if (outputType === 'items') {
            return context.sendJson({ videos }, 'out');
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
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    {
                        value: 'videoId',
                        label: 'Video ID'
                    },
                    {
                        value: 'title',
                        label: 'Title'
                    },
                    {
                        value: 'description',
                        label: 'Description'
                    },
                    {
                        value: 'publishDate',
                        label: 'Publish Date'
                    },
                    {
                        value: 'channelId',
                        label: 'Channel ID'
                    },
                    {
                        value: 'channelTitle',
                        label: 'Channel Title'
                    },
                    {
                        value: 'thumbnailDefault',
                        label: 'Thumbnail (Default)'
                    },
                    {
                        value: 'thumbnailMedium',
                        label: 'Thumbnail (Medium)'
                    },
                    {
                        value: 'thumbnailHigh',
                        label: 'Thumbnail (High)'
                    }

                ],
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
                                        type: 'string',
                                        title: 'Video ID'
                                    },
                                    title: {
                                        type: 'string',
                                        title: 'Title'
                                    },
                                    description: {
                                        type: 'string',
                                        title: 'Description'
                                    },
                                    publishDate: {
                                        type: 'string',
                                        title: 'Publish Date'
                                    },
                                    channelId: {
                                        type: 'string',
                                        title: 'Channel ID'
                                    },
                                    channelTitle: {
                                        type: 'string',
                                        title: 'Channel Title'
                                    },
                                    thumbnailDefault: {
                                        type: 'string',
                                        title: 'Thumbnails (Default)'
                                    },
                                    thumbnailMedium: {
                                        type: 'string',
                                        title: 'Thumbnails (Medium)'
                                    },
                                    thumbnailHigh: {
                                        type: 'string',
                                        title: 'Thumbnails (High)'
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
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
