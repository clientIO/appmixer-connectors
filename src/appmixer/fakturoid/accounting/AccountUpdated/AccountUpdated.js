'use strict';

const fakturoid = require('../../fakturoid-commons');

module.exports = {

    tick(context) {

        return new Promise((resolve, reject) => {
            fakturoid.get('/account.json', context.auth, null, async (err, response, body) => {
                try {
                    if (err) {
                        return reject(err);
                    }
                    if (body && response?.statusCode === 200) {
                        let known = context.state.known;
                        if (known && JSON.stringify(known) !== JSON.stringify(body)) {
                            await context.sendJson(body, 'account');
                        }
                        await context.saveState({ known: body });
                    } else if (!response || response.statusCode !== 200) {
                        return reject(
                            new Error('Fakturoid get account failed with status code ' + response?.statusCode));
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    },

    async test(context) {

        // Reuse the same /account.json read as tick() and emit the account object.
        // tick() only emits when the account changes vs state; test() emits the current one.
        const account = await fakturoid.get('/account.json', context.auth, null);
        if (!account) {
            throw new Error('No account data available to use as test data.');
        }
        return context.sendJson(account, 'account');
    }
};
