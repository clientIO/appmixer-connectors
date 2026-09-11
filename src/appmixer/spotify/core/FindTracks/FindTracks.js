'use strict';

const lib = require('../../lib');

const DEFAULT_MIN_SCORE = 0.75;

// The output contract of one matched track. A dynamic (source) output port has no
// `schema` in component.json - the designer builds the variable picker from the options
// this component emits under `generateOutputPortOptions` - so the schema is exported as
// ITEM_SCHEMA to give the offline tooling the same contract a static port declares.
//
// `popularity`, `available_markets` and `linked_from` are deliberately absent: the
// February 2026 migration removed them from the track object.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'uri', 'name', 'matchScore'],
    properties: {
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
        },
        matchScore: { type: 'number', title: 'Match Score', example: 0.94 }
    }
};

/**
 * @param {*} value
 * @returns {number} the requested threshold, or the default when it is not a 0-1 number
 */
const toThreshold = (value) => {

    const parsed = parseFloat(value);

    if (!Number.isFinite(parsed)) {
        return DEFAULT_MIN_SCORE;
    }

    return Math.min(1, Math.max(0, parsed));
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            query,
            artist,
            title,
            minScore,
            maxResults,
            market,
            outputType = 'array'
        } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Tracks' });
        }

        if (!query && !title) {
            throw new context.CancelError('Either Search Query, or Artist and Title, is required!');
        }

        const structured = Boolean(artist && title);
        const threshold = toThreshold(minScore);
        const request = { query, artist, title };

        let tracks = [];

        if (structured) {
            tracks = await lib.searchTracks(context, {
                query: lib.buildSearchQuery(request),
                maxResults,
                market
            });
        }

        // Fall back to free text either because nothing structured was given, or because
        // the field-scoped search came back empty - a typo inside `artist:"..."` makes
        // Spotify exclude the right track outright, while free text still surfaces it and
        // lets the scorer decide.
        if (!tracks.length) {
            tracks = await lib.searchTracks(context, {
                query: structured ? `${artist} ${title}` : (query || title),
                maxResults,
                market
            });
        }

        const records = lib.rankTracks(request, tracks)
            .filter((record) => record.matchScore >= threshold);

        if (!records.length) {
            // Echo the input back so the notFound branch can hand the same line to an
            // AI fallback or write it to a log without re-deriving it.
            return context.sendJson({
                query: query || null,
                artist: artist || null,
                title: title || null,
                minScore: threshold,
                candidates: tracks.length
            }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
