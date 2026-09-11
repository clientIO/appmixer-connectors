'use strict';

const path = require('path');
const assert = require('assert');

const lib = require(path.join(__dirname, '../../src/appmixer/spotify/lib.js'));

// The scorer is a pure function, so these run offline. The candidate fixtures are the
// shape `GET /v1/search?type=track` returns - hand-built here, because Development Mode
// credentials are not available to unit tests. The input lines are real ones from the
// Radio 1 (Prague) DJ tracklists that motivated the connector: typed by hand, complete
// with typos, "ft", "+" and "/four tet rmx" version suffixes.
const track = (name, artists) => ({
    id: '2GiJYvgVaD2HtM8GqD9EgQ',
    uri: 'spotify:track:2GiJYvgVaD2HtM8GqD9EgQ',
    name,
    artists: artists.map((artistName) => ({ id: '7bu3H8JO7d0UbMoVzbo70s', name: artistName })),
    album: { id: '5rUnPVFPjcx0LPzOGlxUfZ', name: 'Album', release_date: '2024-11-01' }
});

const MIN_SCORE = 0.75;

describe('Spotify match scoring', function() {

    describe('parseArtists', function() {

        it('splits collaborators without eating the artist\'s own punctuation', function() {
            assert.deepStrictEqual(
                lib.parseArtists('fred again...ft young thug'),
                ['fred again', 'young thug']
            );
        });

        it('splits on commas and plus signs', function() {
            assert.deepStrictEqual(
                lib.parseArtists('lane8,sultan+shepard+sadhappy'),
                ['lane8', 'sultan', 'shepard', 'sadhappy']
            );
        });

        it('leaves a single artist whose name contains no separator alone', function() {
            assert.deepStrictEqual(lib.parseArtists('barry can t swim'), ['barry can t swim']);
        });
    });

    describe('parseTitle', function() {

        it('moves a slash-suffixed version out of the title', function() {
            assert.deepStrictEqual(
                lib.parseTitle('alone/four tet rmx'),
                { base: 'alone', version: 'four tet rmx' }
            );
        });

        it('moves a dash-suffixed version out of the title', function() {
            assert.deepStrictEqual(
                lib.parseTitle('Alone - Four Tet Remix'),
                { base: 'alone', version: 'four tet remix' }
            );
        });

        it('moves a parenthesised version out of the title', function() {
            assert.deepStrictEqual(
                lib.parseTitle('Bohemian Rhapsody (Remastered 2011)'),
                { base: 'bohemian rhapsody', version: 'remastered 2011' }
            );
        });

        it('drops a featuring credit without treating it as a version', function() {
            assert.deepStrictEqual(
                lib.parseTitle('Scared (feat. Young Thug)'),
                { base: 'scared', version: '' }
            );
        });

        it('keeps a parenthetical that is part of the title', function() {
            assert.deepStrictEqual(
                lib.parseTitle('P.Y.T. (Pretty Young Thing)'),
                { base: 'pyt pretty young thing', version: '' }
            );
        });
    });

    describe('scoreTrack', function() {

        // Every line here is a Radio 1 tracklist entry followed by the track it should
        // match. The point of each case is in its title.
        const cases = [
            {
                why: 'a one-letter typo in the title',
                request: { artist: 'calibre', title: 'low hangong' },
                candidate: track('Low Hanging', ['Calibre'])
            },
            {
                why: 'typos in both the artist and the title',
                request: { artist: 'beastie bpys', title: 'ch chek it out' },
                candidate: track('Ch-Check It Out', ['Beastie Boys'])
            },
            {
                why: 'a transposed letter in the title',
                request: { artist: 'billie eilish', title: 'bury a driend' },
                candidate: track('bury a friend', ['Billie Eilish'])
            },
            {
                why: 'a slash-suffixed remix matched against Spotify\'s dash-suffixed name',
                request: { artist: 'the cure', title: 'alone/four tet rmx' },
                candidate: track('Alone - Four Tet Remix', ['The Cure', 'Four Tet'])
            },
            {
                why: 'an "ft" collaborator glued to an artist name ending in dots',
                request: { artist: 'fred again...ft young thug', title: 'scared' },
                candidate: track('Scared (feat. Young Thug)', ['Fred again..', 'Young Thug'])
            },
            {
                why: 'an apostrophe typed as a space',
                request: { artist: 'barry can t swim', title: 'sonder' },
                candidate: track('Sonder', ['Barry Can\'t Swim'])
            },
            {
                why: 'a comma/plus separated line-up plus a typo in the title',
                request: { artist: 'lane8,sultan+shepard+sadhappy', title: 'disapear' },
                candidate: track('Disappear', ['Lane 8', 'Sultan + Shepard', 'Sad Happy'])
            }
        ];

        cases.forEach(({ why, request, candidate }) => {
            it(`matches "${request.artist} - ${request.title}" despite ${why}`, function() {
                const score = lib.scoreTrack(request, candidate);
                assert.ok(
                    score >= MIN_SCORE,
                    `expected "${candidate.name}" to score at least ${MIN_SCORE}, got ${score}`
                );
            });
        });

        it('scores an unrelated track far below the default threshold', function() {
            const score = lib.scoreTrack(
                { artist: 'calibre', title: 'low hangong' },
                track('Bohemian Rhapsody', ['Queen'])
            );
            assert.ok(score < MIN_SCORE, `expected a low score, got ${score}`);
        });

        it('scores free text against the artist and title together', function() {
            const score = lib.scoreTrack(
                { query: 'billie eilish bury a friend' },
                track('bury a friend', ['Billie Eilish'])
            );
            assert.ok(score >= MIN_SCORE, `expected a high score, got ${score}`);
        });

        it('returns a number between 0 and 1', function() {
            const score = lib.scoreTrack(
                { artist: 'the cure', title: 'alone/four tet rmx' },
                track('Alone - Four Tet Remix', ['The Cure', 'Four Tet'])
            );
            assert.ok(score >= 0 && score <= 1, `score out of range: ${score}`);
        });
    });

    describe('rankTracks', function() {

        it('prefers the requested remix over the original, whatever Spotify\'s order', function() {
            const ranked = lib.rankTracks(
                { artist: 'the cure', title: 'alone/four tet rmx' },
                [
                    track('Alone', ['The Cure']),
                    track('Alone - Four Tet Remix', ['The Cure', 'Four Tet'])
                ]
            );

            assert.strictEqual(ranked[0].name, 'Alone - Four Tet Remix');
            assert.ok(ranked[0].matchScore > ranked[1].matchScore);
        });

        it('prefers the studio version when no version was requested', function() {
            const ranked = lib.rankTracks(
                { artist: 'the cure', title: 'alone' },
                [
                    track('Alone - Live', ['The Cure']),
                    track('Alone', ['The Cure'])
                ]
            );

            assert.strictEqual(ranked[0].name, 'Alone');
        });

        it('keeps Spotify\'s own order for ties', function() {
            const ranked = lib.rankTracks(
                { artist: 'the cure', title: 'alone' },
                [
                    track('Alone', ['The Cure']),
                    track('Alone', ['The Cure'])
                ]
            );

            assert.strictEqual(ranked[0].matchScore, ranked[1].matchScore);
        });

        it('flattens the track and attaches the score', function() {
            const [record] = lib.rankTracks(
                { artist: 'billie eilish', title: 'bury a friend' },
                [track('bury a friend', ['Billie Eilish'])]
            );

            assert.strictEqual(record.uri, 'spotify:track:2GiJYvgVaD2HtM8GqD9EgQ');
            assert.strictEqual(record.artistNames, 'Billie Eilish');
            assert.strictEqual(record.albumReleaseDate, '2024-11-01');
            assert.strictEqual(typeof record.matchScore, 'number');
            // Removed from the track object by the February 2026 migration.
            assert.ok(!('popularity' in record));
        });
    });

    describe('buildSearchQuery', function() {

        it('scopes the search to the base title and the primary artist', function() {
            assert.strictEqual(
                lib.buildSearchQuery({ artist: 'fred again...ft young thug', title: 'scared' }),
                'track:"scared" artist:"fred again"'
            );
        });

        it('drops the version suffix, which Spotify does not index as part of the track name', function() {
            assert.strictEqual(
                lib.buildSearchQuery({ artist: 'the cure', title: 'alone/four tet rmx' }),
                'track:"alone" artist:"the cure"'
            );
        });
    });
});

describe('Spotify URI parsing', function() {

    // The connector only ever calls these with a real component context; a stub with
    // CancelError is all they touch.
    const context = { CancelError: class CancelError extends Error {} };

    it('accepts an array of Find Tracks records', function() {
        assert.deepStrictEqual(
            lib.parseUris(context, [{ uri: 'spotify:track:2GiJYvgVaD2HtM8GqD9EgQ' }]),
            ['spotify:track:2GiJYvgVaD2HtM8GqD9EgQ']
        );
    });

    it('accepts a comma or newline separated list of ids and links', function() {
        assert.deepStrictEqual(
            lib.parseUris(context, '2GiJYvgVaD2HtM8GqD9EgQ\nhttps://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp?si=x'),
            ['spotify:track:2GiJYvgVaD2HtM8GqD9EgQ', 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp']
        );
    });

    it('passes episode URIs through, because a playlist may hold them', function() {
        assert.deepStrictEqual(
            lib.parseUris(context, 'spotify:episode:2GiJYvgVaD2HtM8GqD9EgQ'),
            ['spotify:episode:2GiJYvgVaD2HtM8GqD9EgQ']
        );
    });

    it('rejects anything that is not a Spotify track', function() {
        assert.throws(() => lib.parseUris(context, 'https://example.com/track/abc'), context.CancelError);
    });

    it('extracts a playlist id from an id, a URI or a link', function() {
        assert.strictEqual(lib.extractPlaylistId(context, '37i9dQZF1DX0XUsuxWHRQd'), '37i9dQZF1DX0XUsuxWHRQd');
        assert.strictEqual(
            lib.extractPlaylistId(context, 'spotify:playlist:37i9dQZF1DX0XUsuxWHRQd'),
            '37i9dQZF1DX0XUsuxWHRQd'
        );
        assert.strictEqual(
            lib.extractPlaylistId(context, 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd?si=x'),
            '37i9dQZF1DX0XUsuxWHRQd'
        );
    });

    it('rejects a missing playlist id', function() {
        assert.throws(() => lib.extractPlaylistId(context, ''), context.CancelError);
    });
});
