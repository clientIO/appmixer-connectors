'use strict';

module.exports = {

    async receive(context) {

        const vatNumber = context.messages.in.content.vat;
        const REQUEST_URL = `https://api.vatcomply.com/vat?vat_number=${vatNumber}`;
        const response = await context.httpRequest({
            method: 'GET',
            url: REQUEST_URL,
            json: true
        });

        const out = response.data;

        return context.sendJson(out, 'out');
    }
};
