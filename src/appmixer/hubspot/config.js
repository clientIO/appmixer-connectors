'use strict';

module.exports = ({ config }) => ({
    appId: config.appId || process.env.HUBSPOT_APP_ID,
    apiKey: config.apiKey || process.env.HUBSPOT_API_KEY
});
