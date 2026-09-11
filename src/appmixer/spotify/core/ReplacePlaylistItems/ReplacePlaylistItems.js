'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { playlistId, uris } = context.messages.in.content || {};

        if (!playlistId) {
            throw new context.CancelError('Playlist ID is required!');
        }

        const id = lib.extractPlaylistId(context, playlistId);
        const items = lib.parseUris(context, uris);

        // PUT with an empty list is Spotify's own way of clearing a playlist, so an
        // empty input is a valid request rather than an error.
        const [first = [], ...rest] = lib.chunk(items, lib.MAX_ITEMS_PER_REQUEST);

        // `PUT /v1/playlists/{id}/tracks` was removed in the February 2026 migration.
        // PUT only accepts 100 URIs, and a second PUT would discard the first one's
        // result, so everything beyond the first chunk is appended with POST.
        await lib.apiRequest(context, {
            method: 'PUT',
            path: `/playlists/${id}/items`,
            data: { uris: first }
        });

        for (const chunk of rest) {
            await lib.apiRequest(context, {
                method: 'POST',
                path: `/playlists/${id}/items`,
                data: { uris: chunk }
            });
        }

        return context.sendJson({}, 'out');
    }
};
