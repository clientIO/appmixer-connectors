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
            .then(async result => {
                for (const [idx, company] of result.entries()) {
                    if (idx >= count) {
                        break;
                    }
                    await context.sendJson(company, 'company');
                }
            });
    }
};
