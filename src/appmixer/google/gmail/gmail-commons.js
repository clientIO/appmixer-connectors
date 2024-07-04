'use strict';
module.exports = {

    async fetchData(context, params) {
        const response = await context.httpRequest(params);
        return response;
    }
};
