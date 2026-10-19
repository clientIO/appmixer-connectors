'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { playlistId, uris, position, skipDuplicates } = context.messages.in.content || {};

        if (!playlistId) {
            throw new context.CancelError('Playlist ID is required!');
        }

        const id = lib.extractPlaylistId(context, playlistId);
        let items = lib.parseUris(context, uris);

        if (!items.length) {
            throw new context.CancelError('Track URIs are required!');
        }

        if (skipDuplicates) {
            // `fields` keeps the round trip small - only the URI is needed to compare.
            const existing = await lib.fetchAll(context, {
                path: `/playlists/${id}/items`,
                params: { fields: 'next,items(item(uri))' }
            });

            const known = new Set(existing.map((entry) => (entry.item || {}).uri).filter(Boolean));
            const seen = new Set();

            items = items.filter((uri) => {
                if (known.has(uri) || seen.has(uri)) {
                    return false;
                }
                seen.add(uri);
                return true;
            });

            if (!items.length) {
                await context.log({ step: 'All items are already in the playlist', playlistId: id });
                return context.sendJson({ snapshotId: null, added: 0 }, 'out');
            }
        }

        // Spotify takes at most 100 URIs per call; a tracklist regularly exceeds that.
        const chunks = lib.chunk(items, lib.MAX_ITEMS_PER_REQUEST);
        const insertAt = Number.isInteger(position) ? position : parseInt(position, 10);
        let offset = Number.isFinite(insertAt) ? insertAt : null;
        let snapshotId = null;

        for (const chunk of chunks) {
            const data = { uris: chunk };
            if (offset !== null) {
                data.position = offset;
                // The next chunk goes after the one just inserted, otherwise the chunks
                // would end up in reverse order.
                offset += chunk.length;
            }

            // `POST /v1/playlists/{id}/tracks` was removed in the February 2026 migration.
            const response = await lib.apiRequest(context, {
                method: 'POST',
                path: `/playlists/${id}/items`,
                data
            });

            snapshotId = (response.data || {}).snapshot_id || snapshotId;
        }

        return context.sendJson({ snapshotId, added: items.length }, 'out');
    }
};
