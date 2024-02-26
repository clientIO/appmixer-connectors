'use strict';
const merk = require('../../merk-commons');

module.exports = {

    receive(context) {

        let query = context.messages.query.content;
        let count = parseInt(query.count, 10);
        if (!Number.isInteger(count)) {
            count = 10;
        }
        delete query.count;

        return merk.get('/suggest/', context.auth.apiKey, query)
            .then(result => {
                result.forEach((company, idx) => {
                    if (idx >= count) {
                        return;
                    }
                    context.sendJson(company, 'company');
                });
            });
    }
};
