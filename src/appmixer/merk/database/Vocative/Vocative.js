'use strict';
const merk = require('../../merk-commons');

module.exports = {

    receive(context) {

        return merk.get('/vokativ/', context.auth.apiKey, context.messages.query.content)
            .then(vokativ => {
                return context.sendJson(vokativ, 'vocative');
            });
    }
};
