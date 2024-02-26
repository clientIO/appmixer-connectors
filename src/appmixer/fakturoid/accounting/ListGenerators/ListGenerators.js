'use strict';
const fakturoid = require('../../fakturoid-commons');

module.exports = {

    receive(context) {

        return fakturoid.get('/generators.json', context.auth, {})
            .then(generators => {
                return context.sendJson(generators, 'generators');
            });
    }
};
