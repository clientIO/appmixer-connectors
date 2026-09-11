'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { name, description, collaborative } = context.messages.in.content || {};
        // Default to a private playlist: a flow that builds a playlist from someone
        // else's tracklist should not publish it to the account's profile by accident.
        const isPublic = context.messages.in.content.public === true;

        if (!name) {
            throw new context.CancelError('Playlist Name is required!');
        }

        const data = { name, public: isPublic };

        if (description) {
            data.description = description;
        }
        if (collaborative) {
            // Spotify rejects a collaborative playlist that is also public.
            data.collaborative = true;
            data.public = false;
        }

        // `POST /v1/users/{id}/playlists` was removed in the February 2026 migration.
        const response = await lib.apiRequest(context, {
            method: 'POST',
            path: '/me/playlists',
            data
        });

        return context.sendJson(lib.mapPlaylist(response.data), 'out');
    }
};
