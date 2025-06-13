'use strict';

module.exports = {
    async receive(context) {
        const {
            boardId,
            boardSectionId,
            title,
            description,
            altText,
            dominantColor,
            link,
            note,
            sourceType,
            imageUrl,
            imageUrlArray,
            imageBase64ContentType,
            imageBase64Data,
            imageBase64Array,
            coverImageUrl,
            mediaId
        } = context.messages.in.content;

        // https://developers.pinterest.com/docs/api/v5/pins-create
        // Build the request body, only including defined and non-empty fields
        const body = {};

        if (boardId) body.board_id = boardId;
        if (boardSectionId) body.board_section_id = boardSectionId;
        if (title) body.title = title;
        if (description) body.description = description;
        if (altText) body.alt_text = altText;
        if (dominantColor) body.dominant_color = dominantColor;
        if (link) body.link = link;
        if (note) body.note = note;

        if (sourceType === 'imageUrl' && imageUrl) {
            body.media_source = {
                source_type: 'image_url',
                url: imageUrl
            };
        }

        if (sourceType === 'multipleImageUrl' && Array.isArray(imageUrlArray?.ADD)) {
            body.media_source = {
                source_type: 'multiple_image_urls',
                items: imageUrlArray.ADD.map(item => ({
                    title: item.title,
                    description: item.description,
                    link: item.link,
                    url: item.url
                })),
                index: 0
            };
        }

        if (sourceType === 'imageBase64' && imageBase64ContentType && imageBase64Data) {
            body.media_source = {
                source_type: 'image_base64',
                content_type: imageBase64ContentType,
                data: imageBase64Data
            };
        }

        if (sourceType === 'multipleImageBase64' && Array.isArray(imageBase64Array?.ADD)) {
            body.media_source = {
                source_type: 'multiple_image_base64',
                items: imageBase64Array.ADD.map(item => ({
                    title: item.title,
                    description: item.description,
                    link: item.link,
                    content_type: item.content_type,
                    data: item.data
                })),
                index: 0
            };
        }

        if (sourceType === 'videoId') {
            body.media_source = {
                source_type: 'video_id',
                cover_image_url: coverImageUrl,
                media_id: mediaId
            };
        }

        const request = {
            method: 'POST',
            url: 'https://api.pinterest.com/v5/pins',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: body
        };

        const { data } = await context.httpRequest(request);

        return context.sendJson(data, 'out');
    }
};
