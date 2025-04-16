'use strict';

const { Address4, Address6 } = require('ip-address');
const { parseIPs } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const MAX_IPS_ALLOWED = parseInt(context.config.blockIpMaxIpsAllowed, 10) || 1000;

        const { siteId, ips, ttl } = context.messages.in.content;

        const ipsValid = [];
        const ipsInvalid = [];

        const allIps = parseIPs(ips);

        for (const ip of allIps) {
            if (Address4.isValid(ip) || Address6.isValid(ip)) {
                if (ipsValid.indexOf(ip) === -1) {
                    ipsValid.push(ip);
                }
            } else {
                ipsInvalid.push(ip);
            }
        }

        if (ipsInvalid.length) {
            throw new context.CancelError('Found invalid IPs: ' + ipsInvalid.join(', '));
        }
        if (ipsValid.length > MAX_IPS_ALLOWED) {
            throw new context.CancelError(`Too many IPs provided. Max ${MAX_IPS_ALLOWED}. You provided ${ipsValid.length}.`);
        }

        // If ttl is not set, the rule will be active indefinitely.
        const removeAfter = ttl ? (new Date().getTime() + ttl * 1000) : null;

        // Processing it in the Appmixer routes as it needs to access the database.
        const response = await context.callAppmixer({
            endPoint: '/plugins/appmixer/imperva/rules-block-ips',
            method: 'POST',
            body: {
                siteId,
                removeAfter,
                ips: ipsValid,
                auth: {
                    id: context.auth.id,
                    key: context.auth.key
                }
            }
        });

        if (response.error) {
            // Show any applied rules in the response
            await context.log({ warning: 'Some rules were processed before the error occurred.', processed: response.processed });
            throw new context.CancelError(response.error);
        }

        return context.sendJson({ processed: response.processed }, 'out');
    }
};
