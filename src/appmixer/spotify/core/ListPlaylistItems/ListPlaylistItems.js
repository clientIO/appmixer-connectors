'use strict';

const lib = require('../../lib');

// The output contract of one playlist entry: the added-at metadata of the entry itself
// plus the flattened track. Exported as ITEM_SCHEMA because the `out` port is dynamic
// (built from `generateOutputPortOptions`) and declares no schema in component.json.
//
// The nested track lives under `item` (renamed from `track`) and no longer carries
// `popularity`, `available_markets` or `linked_from`.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'uri', 'name'],
    properties: {
        addedAt: { type: 'string', format: 'date-time', title: 'Added At', example: '2026-09-11T12:16:03Z' },
        addedById: { type: 'string', title: 'Added By (User ID)', example: 'radio1listener' },
        isLocal: { type: 'boolean', title: 'Local File', example: false },
        id: { type: 'string', title: 'Track ID', example: '2GiJYvgVaD2HtM8GqD9EgQ' },
        uri: { type: 'string', title: 'Track URI', example: 'spotify:track:2GiJYvgVaD2HtM8GqD9EgQ' },
        name: { type: 'string', title: 'Track Name', example: 'Alone - Four Tet Remix' },
        artistNames: { type: 'string', title: 'Artists', example: 'The Cure, Four Tet' },
        artists: {
            type: 'array',
            title: 'Artist Objects',
            example: [{ id: '7bu3H8JO7d0UbMoVzbo70s', name: 'The Cure' }],
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string', title: 'Artist ID', example: '7bu3H8JO7d0UbMoVzbo70s' },
                    name: { type: 'string', title: 'Artist Name', example: 'The Cure' }
                }
            }
        },
        albumId: { type: 'string', title: 'Album ID', example: '5rUnPVFPjcx0LPzOGlxUfZ' },
        albumName: { type: 'string', title: 'Album Name', example: 'Songs Of A Lost World' },
        albumReleaseDate: { type: 'string', title: 'Album Release Date', example: '2024-11-01' },
        durationMs: { type: 'integer', title: 'Duration (ms)', example: 404000 },
        explicit: { type: 'boolean', title: 'Explicit', example: false },
        externalUrl: {
            type: 'string',
            title: 'Spotify URL',
            example: 'https://open.spotify.com/track/2GiJYvgVaD2HtM8GqD9EgQ'
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { playlistId, market, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Playlist Items' });
        }

        if (!playlistId) {
            throw new context.CancelError('Playlist ID is required!');
        }

        const id = lib.extractPlaylistId(context, playlistId);
        const params = {};
        if (market) {
            params.market = market;
        }

        // `GET /v1/playlists/{id}/tracks` was removed in the February 2026 migration.
        const entries = await lib.fetchAll(context, { path: `/playlists/${id}/items`, params });
        const records = entries.map((entry) => lib.mapPlaylistItem(entry));

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
