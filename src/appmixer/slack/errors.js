'use strict';

class SlackAPIError extends Error {

    constructor(apiError) {

        super('An error occurred in the Slack API request.');
        this.apiError = apiError;
    }
}

module.exports = {
    SlackAPIError
}
