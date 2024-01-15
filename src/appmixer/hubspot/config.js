'use strict';
const getEnvVar = (name, defaultValue, parser) => {

    let envVar = process.env[name];
    return envVar ? (typeof parser === 'function' ? parser(envVar) : envVar) : defaultValue;
};

module.exports = context => {

    return {
        appId: context.config.appId || getEnvVar('HUBSPOT_APP_ID', null),
        apiKey: context.config.apiKey || getEnvVar('HUBSPOT_API_KEY', null)
    };
};
