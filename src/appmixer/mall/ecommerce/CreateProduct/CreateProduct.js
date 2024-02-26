'use strict';

module.exports = {

    receive(context) {

        return context.sendJson({
            name: 'My Product',
            price: 300,
            category: 'tshirts'
        }, 'product');
    }
};
