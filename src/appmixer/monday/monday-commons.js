// 'use strict';
const mondaySdk = require('monday-sdk-js');

module.exports = {

    async makeRequest({ query, options, apiKey }) {

        const monday = mondaySdk();
        //monday.setApiVersion('2023-10');
        monday.setToken(apiKey);

        const {
            data,
            errors,
            error_message: errorMessage
        } = await monday.api(query, options);

        if (errors) {
            throw new Error(`Error fetching: ${errors[0].message || JSON.stringify(errors)}`);
        }
        if (errorMessage) {
            throw new Error(`Failure fetching: ${errorMessage}`);
        }

        return data;
    }
};
