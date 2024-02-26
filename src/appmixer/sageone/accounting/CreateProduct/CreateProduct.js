'use strict';
const commons = require('../../sageone-commons');

function buildProduct(productFields) {

    let product = {
        description: productFields.description,
        'sales_price_includes_tax': productFields.salesPriceIncludesTax,
        'ledger_account_id': productFields.ledgerAccountId,
        'tax_code_id': productFields.taxCodeId
    };

    if (productFields.productCode) {
        product['product_code'] = productFields.productCode;
    }

    if (productFields.extraInfo) {
        product['extra_info'] = productFields.extraInfo;
    }

    if (productFields.salesPrice) {
        product['last_cost_price'] = productFields.salesPrice;
    }

    if (productFields.notes) {
        product['sales_price'] = productFields.notes;
    }

    return { product };
}

/**
 * Create new product in Sageone.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const token = context.auth.accessToken;
        const clientSigningSecret = context.auth.profileInfo.clientSigningSecret;
        const userAgent = context.auth.profileInfo.userAgent;
        const url = 'https://api.sageone.com/accounts/v1/products';
        const product = context.messages.product.content;
        const data = buildProduct(product);

        return commons.sageoneAPI('POST', token, url, userAgent, clientSigningSecret, data)
            .then(product => {
                const data = JSON.parse(product);
                return context.sendJson(data, 'newProduct');
            });
    }
};
