'use strict';
const fakturoid = require('../../fakturoid-commons');

// Build the report endpoint from the trigger's properties. Shared by tick() and test()
// so both query the exact same report (same year/kind branch selection).
function reportEndpoint(context) {

    const year = context.properties.year;
    const kind = context.properties.kind;

    return ({
        paid: '/reports/' + year + '/paid.json',
        vat: '/reports/' + year + '/vat.json'
    })[kind] || '/reports/' + year + '.json';
}

module.exports = {

    async tick(context) {

        let endpoint = reportEndpoint(context);

        let report = await fakturoid.get(endpoint, context.auth, null);
        let known = context.state.known;
        if (known && JSON.stringify(known) !== JSON.stringify(report)) {
            await context.sendJson(report, 'report');
        }
        await context.saveState({ known: report });
    },

    async test(context) {

        // Same endpoint (year/kind branch) as tick(). tick() suppresses output until the
        // report changes vs state, but test() emits the current report unconditionally.
        const report = await fakturoid.get(reportEndpoint(context), context.auth, null);
        if (!report) {
            throw new Error('No report available to use as test data.');
        }
        return context.sendJson(report, 'report');
    }
};
