'use strict';
const fakturoid = require('../../fakturoid-commons');

module.exports = {

    receive(context) {

        return fakturoid.get('/subjects.json', context.auth, {})
            .then(subjects => {
                return context.sendJson(subjects, 'subjects');
            });
    }
};
