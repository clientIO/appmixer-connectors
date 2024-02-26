'use strict';

module.exports = {

    async receive(context) {

        let item;
        let key;
        if (context.messages.add) {
            item = context.messages.add.originalContent;
            key = context.messages.add.content.key;
        } else if (context.messages.remove) {
            item = context.messages.remove.originalContent;
            key = context.messages.remove.content.key;
        }

        let state = context.state || {};

        // make sure to stringify, even when we get object
        key = JSON.stringify(key);

        if (context.messages.add) {
            if (state[key]) {
                await context.sendJson(item, 'updated');
            } else {
                await context.sendJson(item, 'new');
            }
            state[key] = item;
        } else if (context.messages.remove) {
            if (state[key]) {
                await context.sendJson(item, 'removed');
                delete state[key];
            }
        }
        await context.saveState(state);
    }
};
