'use strict';
const fakturoid = require('../../fakturoid-commons');
const Promise = require('bluebird');

module.exports = {

    async tick(context) {

        let todos = await fakturoid.get('/todos.json', context.auth, {});
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let actual = [];
        let diff = [];

        if (Array.isArray(todos)) {
            todos.forEach(context.utils.processItem.bind(
                null, known, actual, diff, item => item.id));
        }

        await Promise.map(diff, todo => {
            context.sendJson(todo, 'todo');
        });
        await context.saveState({ known: actual });
    }
};
