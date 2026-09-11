'use strict';

const pathModule = require('path');

const API_ORIGIN = 'https://api.spotify.com';
const API_BASE_URL = `${API_ORIGIN}/v1`;
const DEFAULT_PREFIX = 'spotify-objects-export';

// `GET /v1/search` caps `limit` at 10 (default 5) since the February 2026 migration,
// so anything above one page has to be walked with `offset`.
const SEARCH_PAGE_SIZE = 10;
// FindTracks scores every candidate locally, so the ceiling is about how much of the
// rolling 30-second rate-limit window one message may spend: 5 search pages.
const MAX_SEARCH_RESULTS = 50;
// `POST/PUT /v1/playlists/{id}/items` accept at most 100 URIs per call.
const MAX_ITEMS_PER_REQUEST = 100;
// `/v1/me/playlists` and `/v1/playlists/{id}/items` page at 50.
const MAX_PAGE_SIZE = 50;
// Guards a runaway `next` chain on a pathological account.
const MAX_PAGES = 40;

// Spotify answers a breach of the rolling 30-second window with 429 + Retry-After.
const MAX_RETRIES = 3;
const MAX_RETRY_AFTER_SECONDS = 60;

// `score = 0.4 x artistScore + 0.6 x titleScore` - the title carries more weight
// because a tracklist line is far more likely to misspell the artist than to name a
// different song, and because the artist is matched against every credited artist.
const ARTIST_WEIGHT = 0.4;
const TITLE_WEIGHT = 0.6;
const VERSION_BONUS = 0.05;
const VERSION_PENALTY = 0.05;

// How a hand-typed artist field separates collaborators. `\bx\b` catches the
// "artist a x artist b" style; a stray empty part is dropped by the caller.
const ARTIST_SEPARATORS = /\s*(?:\bfeaturing\b|\bfeat\b\.?|\bft\b\.?|\bwith\b|\bvs\b\.?|\bx\b|&|\+|,|\/)\s*/i;

// A trailing segment counts as version info only when it contains one of these -
// otherwise "P.Y.T. (Pretty Young Thing)" would lose half its title.
const VERSION_KEYWORDS = [
    'remix', 'rmx', 'mix', 'edit', 'version', 'remaster', 'remastered', 'live',
    'acoustic', 'instrumental', 'karaoke', 'extended', 'radio', 'dub', 'bootleg',
    'vip', 'rework', 'cover', 'demo', 'session', 'mono', 'stereo', 'reprise'
];

// A candidate carrying one of these when no version was asked for is a different
// recording of the same song, so it is nudged below the plain studio version.
const UNWANTED_VERSION_KEYWORDS = ['remix', 'rmx', 'live', 'karaoke', 'instrumental'];

// "(feat. Young Thug)" is a credit, not a version: drop it from the title instead of
// comparing it against a tracklist line that never had it.
const FEATURED_PREFIX = /^(?:feat|ft|featuring|with)\b/;

// The three ways a tracklist - or Spotify itself - appends version info to a title.
const VERSION_SUFFIXES = [
    /\s*[([]([^)\]]+)[)\]]\s*$/,  // "Alone (Four Tet Remix)"
    /\s+-\s+([^-]+)$/,            // "Alone - Four Tet Remix"
    /\s*\/\s*([^/]+)$/            // "alone/four tet rmx"
];

// A Spotify object id is 22 base62 characters.
const TRACK_ID_PATTERN = /^[A-Za-z0-9]{22}$/;
const TRACK_URI_PATTERN = /^spotify:(?:track|episode):[A-Za-z0-9]+$/;
const TRACK_URL_PATTERN = /^https?:\/\/open\.spotify\.com\/(?:[a-z-]+\/)?(track|episode)\/([A-Za-z0-9]+)/i;
const PLAYLIST_URI_PATTERN = /^spotify:playlist:([A-Za-z0-9]+)$/;
const PLAYLIST_URL_PATTERN = /^https?:\/\/open\.spotify\.com\/(?:[a-z-]+\/)?playlist\/([A-Za-z0-9]+)/i;

// NFD splits "é" into "e" + U+0301; dropping the combining block leaves the base letter.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');
const stripDiacritics = (text) => String(text).normalize('NFD').replace(COMBINING_MARKS, '');

/**
 * Lowercase, strip diacritics, drop punctuation and collapse whitespace.
 * Dropping punctuation without inserting a space is what turns "don't" into "dont".
 * @param {string} text
 * @returns {string}
 */
const normalize = (text) => stripDiacritics(String(text === null || text === undefined ? '' : text).toLowerCase())
    .replace(/[^a-z0-9\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Normalize and then remove the spaces too. This is what makes a typo distance
 * meaningful across a mistyped space: "barry can t swim" and "Barry Can't Swim"
 * both compact to "barrycantswim".
 * @param {string} text
 * @returns {string}
 */
const compact = (text) => normalize(text).replace(/\s/g, '');

/**
 * Plain Levenshtein distance over two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const levenshtein = (a, b) => {

    if (a === b) {
        return 0;
    }
    if (!a.length) {
        return b.length;
    }
    if (!b.length) {
        return a.length;
    }

    let previous = Array.from({ length: b.length + 1 }, (value, index) => index);

    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
        }
        previous = current;
    }

    return previous[b.length];
};

/**
 * Levenshtein distance normalized into a 0-1 similarity.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const ratio = (a, b) => {

    if (!a && !b) {
        return 1;
    }
    if (!a || !b) {
        return 0;
    }

    return 1 - (levenshtein(a, b) / Math.max(a.length, b.length));
};

/**
 * Token-set similarity: every token is matched against its best counterpart on the
 * other side, averaged in both directions so a dropped "the" costs the same either way.
 * This is the half of the comparison that tolerates reordered or missing words.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const tokenSetSimilarity = (a, b) => {

    const left = normalize(a).split(' ').filter(Boolean);
    const right = normalize(b).split(' ').filter(Boolean);

    if (!left.length || !right.length) {
        return (!left.length && !right.length) ? 1 : 0;
    }

    const bestAverage = (tokens, others) => tokens.reduce(
        (sum, token) => sum + others.reduce((max, other) => Math.max(max, ratio(token, other)), 0),
        0
    ) / tokens.length;

    return (bestAverage(left, right) + bestAverage(right, left)) / 2;
};

/**
 * The similarity FindTracks scores with: the better of the whitespace-insensitive
 * typo distance and the token-set comparison.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const similarity = (a, b) => Math.max(ratio(compact(a), compact(b)), tokenSetSimilarity(a, b));

const clamp = (score) => Math.min(1, Math.max(0, score));

const round = (score) => Math.round(score * 10000) / 10000;

const hasKeyword = (text, keywords) => normalize(text).split(' ').some((token) => keywords.includes(token));

module.exports = {

    API_ORIGIN,
    API_BASE_URL,
    SEARCH_PAGE_SIZE,
    MAX_SEARCH_RESULTS,
    MAX_ITEMS_PER_REQUEST,
    MAX_PAGE_SIZE,

    normalize,
    compact,
    similarity,

    /**
     * Split a hand-typed artist field into its individual artists. The split runs on
     * the raw text, before punctuation is dropped, so "fred again...ft young thug"
     * still separates on "ft" instead of collapsing into "againft".
     * @param {string} artist
     * @returns {Array<string>} normalized artist names, primary first
     */
    parseArtists(artist) {

        return String(artist === null || artist === undefined ? '' : artist)
            .split(ARTIST_SEPARATORS)
            .map(normalize)
            .filter(Boolean);
    },

    /**
     * Split a title into the song itself and any version info appended to it, so that
     * "alone/four tet rmx" and Spotify's "Alone - Four Tet Remix" compare as the same
     * song with the same requested version instead of as two different titles.
     * @param {string} title
     * @returns {{ base: string, version: string }} both normalized
     */
    parseTitle(title) {

        let base = String(title === null || title === undefined ? '' : title).trim();
        const versions = [];
        let matched = true;

        while (matched && base) {
            matched = false;
            for (const pattern of VERSION_SUFFIXES) {
                const match = base.match(pattern);
                if (!match) {
                    continue;
                }

                const segment = normalize(match[1]);
                const isFeatured = FEATURED_PREFIX.test(segment);
                const isVersion = hasKeyword(segment, VERSION_KEYWORDS);

                // Neither a credit nor a version - part of the title, leave it alone.
                if (!isFeatured && !isVersion) {
                    continue;
                }
                if (isVersion) {
                    versions.unshift(segment);
                }

                base = base.slice(0, match.index).trim();
                matched = true;
                break;
            }
        }

        return { base: normalize(base), version: versions.join(' ') };
    },

    /**
     * Score one Spotify track against the requested line, 0-1.
     *
     * With `artist` and `title` both present this is the weighted artist/title match
     * described above. With only free text (`query`, or a bare `title`) there is
     * nothing to weigh, so the text is compared against the candidate as a whole.
     *
     * Pure function: no context, no I/O - it is the part of FindTracks that is unit tested.
     * @param {object} request - { artist, title, query }
     * @param {object} candidate - a Spotify track object ({ name, artists: [{ name }] })
     * @returns {number} match score between 0 and 1
     */
    scoreTrack(request = {}, candidate = {}) {

        const { artist, title, query } = request;
        const candidateArtists = (candidate.artists || [])
            .map((entry) => normalize(entry && entry.name))
            .filter(Boolean);

        if (!artist || !title) {
            const text = title || query || '';
            const haystack = title
                ? candidate.name
                : `${candidateArtists.join(' ')} ${candidate.name || ''}`;
            return round(clamp(similarity(text, haystack)));
        }

        const requested = this.parseTitle(title);
        const found = this.parseTitle(candidate.name);
        const primaryArtist = this.parseArtists(artist)[0] || normalize(artist);

        const artistScore = candidateArtists.length
            ? Math.max(...candidateArtists.map((name) => similarity(primaryArtist, name)))
            : 0;
        const titleScore = similarity(requested.base, found.base);

        let score = (ARTIST_WEIGHT * artistScore) + (TITLE_WEIGHT * titleScore);

        if (requested.version) {
            // The candidate may spell the version anywhere in its name ("Alone - Four
            // Tet Remix") or only approximately ("rmx" vs "remix"), so accept either.
            const needle = compact(requested.version);
            const haystack = compact(`${candidate.name || ''} ${candidateArtists.join(' ')}`);
            const matches = needle
                && (haystack.includes(needle) || similarity(requested.version, found.version) >= 0.8);

            // The penalty on the other branch is the part that makes the version
            // actually decide anything. "Alone" and "Alone - Four Tet Remix" both have
            // a perfect artist and base-title match, so the bonus alone would clamp
            // both to 1.0 and the wrong recording could win on Spotify's ordering.
            score += matches ? VERSION_BONUS : -VERSION_PENALTY;
        } else if (hasKeyword(found.version, UNWANTED_VERSION_KEYWORDS)) {
            score -= VERSION_PENALTY;
        }

        return round(clamp(score));
    },

    /**
     * Score and sort candidates. Ties keep Spotify's own ordering: `popularity` is
     * gone since the February 2026 migration, so the API's relevance sort is the only
     * remaining tie-breaker.
     * @param {object} request - { artist, title, query }
     * @param {Array<object>} tracks - raw Spotify track objects
     * @returns {Array<object>} mapped records, each carrying `matchScore`, best first
     */
    rankTracks(request, tracks = []) {

        return tracks
            .map((track, index) => ({ track, index, matchScore: this.scoreTrack(request, track) }))
            .sort((a, b) => (b.matchScore - a.matchScore) || (a.index - b.index))
            .map(({ track, matchScore }) => ({ ...this.mapTrack(track), matchScore }));
    },

    /**
     * Build the field-scoped search Spotify answers best for a structured request.
     * The normalized parts are quoted, which is safe because normalization has already
     * removed every quote character.
     * @param {object} request - { artist, title }
     * @returns {string}
     */
    buildSearchQuery({ artist, title } = {}) {

        const { base } = this.parseTitle(title);
        const primaryArtist = this.parseArtists(artist)[0] || normalize(artist);

        return `track:"${base}" artist:"${primaryArtist}"`;
    },

    /**
     * Build the auth headers for the Spotify Web API.
     * @param {object} context
     * @returns {object}
     */
    authHeaders(context) {

        return { 'Authorization': `Bearer ${context.auth.accessToken}` };
    },

    /**
     * Resolve a MakeApiCall endpoint input into an absolute URL pinned to the Spotify
     * API origin. A relative path is appended to the API base; an absolute URL is
     * accepted only when it targets `https://api.spotify.com`, so the connected
     * account's access token can never be sent to a foreign host.
     * @param {object} context
     * @param {string} url - relative path (e.g. '/me/playlists') or absolute Spotify URL
     * @returns {string}
     */
    resolveApiUrl(context, url) {

        const input = String(url).trim();
        const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(input) || input.startsWith('//');
        const candidate = isAbsolute ? input : `${API_BASE_URL}${input.startsWith('/') ? '' : '/'}${input}`;

        let parsed;
        try {
            parsed = new URL(candidate);
        } catch (error) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }

        if (parsed.origin !== API_ORIGIN) {
            throw new context.CancelError(
                `API Endpoint Path must target ${API_ORIGIN}, got ${parsed.origin}.`
            );
        }

        return parsed.toString();
    },

    /**
     * Authorized request against the Spotify Web API, retrying 429s for as long as
     * `Retry-After` asks. The quota manager keeps the flow under the rolling
     * 30-second window; this handles the breaches that still get through (other
     * integrations share the same app credentials).
     * @param {object} context
     * @param {object} options - { method, path, url, params, data, headers }
     * @returns {Promise<object>} the axios-like response
     */
    async apiRequest(context, { method = 'GET', path, url, params, data, headers = {} } = {}) {

        const options = {
            method,
            url: url || `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`,
            headers: { ...this.authHeaders(context), ...headers }
        };

        if (params && Object.keys(params).length) {
            options.params = params;
        }
        if (data !== undefined) {
            options.data = data;
            options.headers['Content-Type'] = 'application/json';
        }

        for (let attempt = 0; ; attempt++) {
            try {
                return await context.httpRequest(options);
            } catch (error) {
                const response = error.response || {};
                const retryAfter = parseInt((response.headers || {})['retry-after'], 10);

                if (response.status !== 429 || attempt >= MAX_RETRIES) {
                    throw this.normalizeError(context, error);
                }

                const waitSeconds = Math.min(Number.isFinite(retryAfter) ? retryAfter : 1, MAX_RETRY_AFTER_SECONDS);
                await context.log({ step: 'Spotify rate limited (429), retrying', url: options.url, waitSeconds });
                await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
            }
        }
    },

    /**
     * Translate a Spotify HTTP error into a helpful CancelError. Development Mode adds
     * two failure modes that are otherwise baffling, so they get their own hints.
     * @param {object} context
     * @param {Error} error
     * @returns {Error}
     */
    normalizeError(context, error) {

        const response = error.response || {};
        const status = response.status;
        let body = response.data;

        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (parseError) { /* keep the raw string */ }
        }

        const detail = (body && body.error && (body.error.message || body.error_description || body.error))
            || (typeof body === 'string' ? body : '')
            || error.message;

        const hints = {
            401: 'Authentication failed (401). Reconnect the Spotify account.',
            403: 'Access denied (403). A Development Mode app serves at most 5 users, each added in the app\'s User Management, and stops working when the owner\'s Spotify Premium subscription lapses. The connected account may also be missing a scope, or may not own this playlist.',
            404: 'Not found (404). The resource does not exist, or the endpoint was removed in the February 2026 migration (use /playlists/{id}/items, not /tracks).',
            429: 'Rate limit exceeded (429). Spotify meters a rolling 30-second window.'
        };

        const message = [hints[status] || `Spotify API request failed${status ? ` (${status})` : ''}.`]
            .concat(detail && detail !== hints[status] ? [String(detail)] : [])
            .join(' ');

        const cancelError = new context.CancelError(message);
        cancelError.status = status;

        return cancelError;
    },

    /**
     * Run `GET /v1/search?type=track`, walking `offset` because a page holds 10 results.
     * @param {object} context
     * @param {object} options - { query, maxResults, market }
     * @returns {Promise<Array<object>>} raw Spotify track objects in the API's order
     */
    async searchTracks(context, { query, maxResults = SEARCH_PAGE_SIZE, market } = {}) {

        const wanted = Math.min(Math.max(parseInt(maxResults, 10) || SEARCH_PAGE_SIZE, 1), MAX_SEARCH_RESULTS);
        const tracks = [];
        let offset = 0;

        while (tracks.length < wanted) {
            const limit = Math.min(SEARCH_PAGE_SIZE, wanted - tracks.length);
            const params = { q: query, type: 'track', limit, offset };
            if (market) {
                params.market = market;
            }

            const { data } = await this.apiRequest(context, { method: 'GET', path: '/search', params });
            const page = ((data && data.tracks && data.tracks.items) || []).filter(Boolean);

            tracks.push(...page);

            if (page.length < limit) {
                break;
            }
            offset += page.length;
        }

        return tracks;
    },

    /**
     * Walk a Spotify paging object through its `next` links.
     * @param {object} context
     * @param {object} options - { path, params, limit }
     * @returns {Promise<Array<object>>}
     */
    async fetchAll(context, { path, params = {}, limit = MAX_PAGE_SIZE } = {}) {

        const records = [];
        let next = null;
        let pages = 0;

        do {
            const request = next
                ? { method: 'GET', url: next }
                : { method: 'GET', path, params: { limit, ...params } };

            const { data } = await this.apiRequest(context, request);

            records.push(...((data && data.items) || []).filter(Boolean));
            next = (data && data.next) || null;
            pages++;
        } while (next && pages < MAX_PAGES);

        return records;
    },

    /**
     * Accept anything a flow might carry a playlist in - a bare id, a `spotify:playlist:`
     * URI or an open.spotify.com link - and return the bare id the API paths need.
     * @param {object} context
     * @param {string} value
     * @returns {string}
     */
    extractPlaylistId(context, value) {

        const input = String(value === null || value === undefined ? '' : value).trim();

        if (!input) {
            throw new context.CancelError('Playlist ID is required!');
        }

        const uriMatch = input.match(PLAYLIST_URI_PATTERN);
        if (uriMatch) {
            return uriMatch[1];
        }

        const urlMatch = input.match(PLAYLIST_URL_PATTERN);
        if (urlMatch) {
            return urlMatch[1];
        }

        if (TRACK_ID_PATTERN.test(input)) {
            return input;
        }

        throw new context.CancelError(`Not a valid Spotify playlist ID, URI or URL: ${value}`);
    },

    /**
     * Turn the `uris` input - an array from FindTracks, or a comma / newline separated
     * list typed by hand - into the `spotify:track:` URIs the playlist endpoints take.
     * Bare ids and open.spotify.com links are accepted; `spotify:episode:` URIs are
     * passed through because a playlist may legitimately hold podcast episodes.
     * @param {object} context
     * @param {string|Array} value
     * @returns {Array<string>}
     */
    parseUris(context, value) {

        let list = [];

        if (Array.isArray(value)) {
            list = value;
        } else if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.startsWith('[')) {
                try {
                    list = JSON.parse(trimmed);
                } catch (error) {
                    list = trimmed.split(/[\n,]+/);
                }
            } else {
                list = trimmed.split(/[\n,]+/);
            }
        } else if (value) {
            list = [value];
        }

        if (!Array.isArray(list)) {
            list = [list];
        }

        return list
            // FindTracks records can be forwarded whole instead of mapped to `uri`.
            .map((entry) => (entry && typeof entry === 'object' ? (entry.uri || entry.id) : entry))
            .map((entry) => String(entry === null || entry === undefined ? '' : entry).trim())
            .filter(Boolean)
            .map((entry) => {

                if (TRACK_URI_PATTERN.test(entry)) {
                    return entry;
                }

                const urlMatch = entry.match(TRACK_URL_PATTERN);
                if (urlMatch) {
                    return `spotify:${urlMatch[1].toLowerCase()}:${urlMatch[2]}`;
                }

                if (TRACK_ID_PATTERN.test(entry)) {
                    return `spotify:track:${entry}`;
                }

                throw new context.CancelError(`Not a valid Spotify track URI, ID or URL: ${entry}`);
            });
    },

    /**
     * Split a list into chunks of at most `size` entries.
     * @param {Array} list
     * @param {number} size
     * @returns {Array<Array>}
     */
    chunk(list = [], size = MAX_ITEMS_PER_REQUEST) {

        const chunks = [];
        for (let index = 0; index < list.length; index += size) {
            chunks.push(list.slice(index, index + size));
        }
        return chunks;
    },

    /**
     * Flatten a Spotify track object into the connector's output record. `popularity`,
     * `available_markets` and `linked_from` are deliberately absent - the February 2026
     * migration removed them from the track object.
     * @param {object} track
     * @returns {object}
     */
    mapTrack(track) {

        const source = track || {};
        const album = source.album || {};
        const artists = (source.artists || []).filter(Boolean);

        return {
            id: source.id,
            uri: source.uri,
            name: source.name,
            artistNames: artists.map((artist) => artist.name).filter(Boolean).join(', '),
            artists: artists.map((artist) => ({ id: artist.id, name: artist.name })),
            albumId: album.id,
            albumName: album.name,
            albumReleaseDate: album.release_date,
            durationMs: source.duration_ms,
            explicit: source.explicit,
            externalUrl: (source.external_urls || {}).spotify
        };
    },

    /**
     * Flatten a Spotify playlist object. The item count comes from `items.total`:
     * the playlist object's `tracks` field was renamed to `items` in February 2026.
     * @param {object} playlist
     * @returns {object}
     */
    mapPlaylist(playlist) {

        const source = playlist || {};
        const owner = source.owner || {};
        const images = source.images || [];

        return {
            id: source.id,
            uri: source.uri,
            name: source.name,
            description: source.description,
            public: source.public,
            collaborative: source.collaborative,
            snapshotId: source.snapshot_id,
            ownerId: owner.id,
            ownerName: owner.display_name,
            totalItems: (source.items || {}).total,
            externalUrl: (source.external_urls || {}).spotify,
            imageUrl: (images[0] || {}).url
        };
    },

    /**
     * Flatten one entry of `GET /v1/playlists/{id}/items`. The nested track now lives
     * under `item` rather than `track`.
     * @param {object} entry
     * @returns {object}
     */
    mapPlaylistItem(entry) {

        const source = entry || {};

        return {
            addedAt: source.added_at,
            addedById: (source.added_by || {}).id,
            isLocal: source.is_local,
            ...this.mapTrack(source.item)
        };
    },

    async sendArrayOutput({
        context,
        outputPortName = 'out',
        outputType = 'array',
        records = []
    }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {

            const csvString = toCsv(records);
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = schema;

                    res.push({
                        label: fieldLabel, value: field, schema: schemaWithoutTitle
                    });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);

            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label: label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: itemSchema
                    }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {

    if (!array.length) {
        return '';
    }

    const headers = Object.keys(array[0]);

    return [
        headers.join(','),
        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
};
