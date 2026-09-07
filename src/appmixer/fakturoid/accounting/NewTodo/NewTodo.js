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
    },

    async test(context) {

        // Reuse the same request path as tick(). The todos endpoint returns todos
        // newest-first by default, so emit the first (latest) one. No dedup/state:
        // tick() suppresses the first poll (baseline), but test() must return a real item.
        const todos = await fakturoid.get('/todos.json', context.auth, {});
        const todo = Array.isArray(todos) ? todos[0] : null;
        if (!todo) {
            throw new Error('No recent todo to use as test data.');
        }
        return context.sendJson(todo, 'todo');
    }
};
