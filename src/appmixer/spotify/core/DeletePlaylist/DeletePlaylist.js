'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { playlistId } = context.messages.in.content || {};

        if (!playlistId) {
            throw new context.CancelError('Playlist ID is required!');
        }

        const id = lib.extractPlaylistId(context, playlistId);

        // Spotify has no hard delete for a playlist. `DELETE /v1/me/library` removes it
        // from the owner's library, which is the closest thing and what the Spotify
        // clients themselves call "Delete". It replaced
        // `DELETE /v1/playlists/{id}/followers` in the February 2026 migration.
        await lib.apiRequest(context, {
            method: 'DELETE',
            path: '/me/library',
            data: { ids: [`spotify:playlist:${id}`] }
        });

        return context.sendJson({}, 'out');
    }
};
