'use strict';
const fakturoid = require('../../fakturoid-commons');

module.exports = {

    async tick(context) {

        let year = context.properties.year;
        let kind = context.properties.kind;

        let endpoint = ({
            paid: '/reports/' + year + '/paid.json',
            vat: '/reports/' + year + '/vat.json'
        })[kind] || '/reports/' + year + '.json';

        let report = await fakturoid.get(endpoint, context.auth, null);
        let known = context.state.known;
        if (known && JSON.stringify(known) !== JSON.stringify(report)) {
            await context.sendJson(report, 'report');
        }
        await context.saveState({ known: report });
    }
};
