'use strict';

// Base URL for the Strava API (v3).
//
// Strava has announced a migration of the API base URL from
// `https://www.strava.com/api/v3` to `https://api-v3.strava.com`. The new
// host only becomes available on January 4, 2027, so until then the legacy
// URL remains the only working host and stays the default here.
//
// The base URL is centralized in this single constant so the migration can be
// performed with a one-line change once the new host is live.
// See https://developers.strava.com/docs/changelog/
const API_BASE_URL = 'https://www.strava.com/api/v3';

module.exports = {
    API_BASE_URL
};
