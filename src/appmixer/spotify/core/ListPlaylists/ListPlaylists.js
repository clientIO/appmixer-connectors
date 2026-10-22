'use strict';

const lib = require('../../lib');

// The output contract of one playlist. Exported as ITEM_SCHEMA because the `out` port is
// dynamic (built from `generateOutputPortOptions`) and therefore declares no schema of
// its own in component.json.
//
// `totalItems` comes from `items.total`: the playlist object's `tracks` field was
// renamed to `items` in the February 2026 migration.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'uri', 'name'],
    properties: {
        id: { type: 'string', title: 'Playlist ID', example: '37i9dQZF1DX0XUsuxWHRQd' },
        uri: { type: 'string', title: 'Playlist URI', example: 'spotify:playlist:37i9dQZF1DX0XUsuxWHRQd' },
        name: { type: 'string', title: 'Playlist Name', example: 'Radio 1 - BLN 2026-09-11' },
        description: {
            type: 'string',
            title: 'Description',
            example: 'Tracklist of the show broadcast on 2026-09-11.'
        },
        public: { type: 'boolean', title: 'Public', example: false },
        collaborative: { type: 'boolean', title: 'Collaborative', example: false },
        snapshotId: {
            type: 'string',
            title: 'Snapshot ID',
            example: 'MTgsMGRkYzcxMmQwZWMyZWU4ZmY0YjM2ZDY3ZDBmMTgyODdmYjFiZGQxNw=='
        },
        ownerId: { type: 'string', title: 'Owner ID', example: 'radio1listener' },
        ownerName: { type: 'string', title: 'Owner Name', example: 'Radio 1 Listener' },
        totalItems: { type: 'integer', title: 'Total Items', example: 38 },
        externalUrl: {
            type: 'string',
            title: 'Spotify URL',
            example: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd'
        },
        imageUrl: {
            type: 'string',
            title: 'Cover Image URL',
            example: 'https://i.scdn.co/image/ab67706f00000002ca5a7517156021292e5663a6'
        }
    }
};

const CACHE_TTL = 2 * 60 * 1000;

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Playlists' });
        }

        // Not a source call - hit the API and let errors reach the flow.
        if (!isSource) {
            const playlists = await lib.fetchAll(context, { path: '/me/playlists' });
            const records = playlists.map((playlist) => lib.mapPlaylist(playlist));
            return lib.sendArrayOutput({ context, records, outputType });
        }

        // Source call: this component backs the Playlist dropdown on the other
        // components. The designer fires those in a burst whenever an inspector opens,
        // and Spotify meters a rolling 30-second window, so cache behind a lock and
        // render an empty dropdown rather than an error.
        const cacheKey = `spotify_playlists_${context.auth.accessToken}`;
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return context.sendJson({ result: cached }, 'out');
            }

            const playlists = await lib.fetchAll(context, { path: '/me/playlists' });

            // Only the fields the selector needs, to keep the cache small.
            const options = playlists.map((playlist) => ({ id: playlist.id, name: playlist.name }));

            await context.staticCache.set(cacheKey, options, context.config.listCacheTTL || CACHE_TTL);

            return context.sendJson({ result: options }, 'out');
        } catch (error) {
            return context.sendJson({ result: [] }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    // Used by the Playlist dropdown (source) across the connector.
    toSelectArray({ result }) {

        return (result || []).map((record) => ({
            label: record.name || record.id,
            value: record.id
        }));
    }
};
