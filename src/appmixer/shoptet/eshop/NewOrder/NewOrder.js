'use strict';

module.exports = {

    receive(context) {

        return context.sendJson({
            id: 123,
            total: 500,
            items: [1, 2, 3]
        }, 'order');
    }
};
