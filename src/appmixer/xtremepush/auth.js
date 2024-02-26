'use strict';

const { makeRequest } = require('./common');

module.exports = {

    type: 'apiKey',


    definition: {

        accountNameFromProfileInfo: 'projectName',

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                required: true,
                tooltip: 'Log into your xtreampush account and find it in <i>Settings > Integrations > API Integration</i> page.'
            },
            projectName: {
                type: 'text',
                name: 'Project Name',
                tooltip: 'Enter your project name.'
            }
        },
        validate: async context => {

            await makeRequest({ context, options: { path: '/list/profile' , data: { 'limit': 1 } } });
            return true;
        }
    }
};
