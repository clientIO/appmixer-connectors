/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { productId } = context.messages.in.content;

        if (!productId) {
            throw new context.CancelError('Product ID is required!');
        }

        const data = await lib.psRequest(context, {
            path: '/stock_availables',
            params: {
                'filter[id_product]': productId,
                display: 'full'
            }
        });

        const stock_availables = data.stock_availables || [];
        const quantity = stock_availables.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);

        return context.sendJson({ id_product: String(productId), quantity, stock_availables }, 'out');
    }
};
