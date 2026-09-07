'use strict';

const lib = require('../../lib');
const { generateAuthorizationHeader, parseIPs, ACTIVATION_STATUS } = lib;

// GET the current entries, split the input IPs into append/update, POST the
// changes and trigger an activation. Returns the entries for the output port
// and the activation response.
async function upsertAndActivate(context, auth, { listId, network, value, description, ttl }) {

    const { hostnameUrl, accessToken, clientSecret, clientToken } = auth;

    // GET list items to check whether to append or update
    const {
        url: getItemsUrl,
        method: getItemsMethod,
        headers: { Authorization: getItemsAuthorization }
    } = generateAuthorizationHeader({
        hostnameUrl,
        accessToken,
        clientToken,
        clientSecret,
        method: 'GET',
        path: `/client-list/v1/lists/${listId}/items`
    });

    const { data: listEntries } = await context.httpRequest({
        url: getItemsUrl,
        method: getItemsMethod,
        headers: { Authorization: getItemsAuthorization }
    });

    const currentEntries = listEntries.content.map((entry) => entry.value);

    const appendArr = [];
    const updateArr = [];

    const expirationDate = ttl
        ? new Date().getTime() + ttl * 1000
        : undefined;

    const ips = parseIPs(value);

    ips.forEach(ip => {
        const ipIndex = currentEntries.findIndex(
            (e) => e === ip
        );
        const newEntry = {
            value: ip,
            expirationDate,
            description
        };
        if (ipIndex > -1) {
            updateArr.push(newEntry);
        } else {
            appendArr.push(newEntry);
        }
    });

    const body = {
        append: appendArr,
        update: updateArr
    };

    // POST new or updated list items
    const {
        url,
        method,
        headers: { Authorization }
    } = generateAuthorizationHeader({
        hostnameUrl,
        accessToken,
        clientToken,
        clientSecret,
        method: 'POST',
        path: `/client-list/v1/lists/${listId}/items`,
        body
    });

    const { data } = await context.httpRequest({
        url,
        method,
        headers: { Authorization },
        data: body
    });

    const activation = await lib.activateList(context, auth, { listId, network });

    const addedResponse = (data.appended || []).map(r => ({ action: 'added', ...r }));
    const updatedResponse = (data.updated || []).map(r => ({ action: 'updated', ...r }));

    return {
        entries: addedResponse.concat(updatedResponse),
        activation
    };
}

module.exports = {

    receive: async (context) => {

        // Poll continuation scheduled by a previous receive() invocation.
        if (context.messages.timeout) {
            return lib.continueWait(context, {
                onClear: async (ctx, wait) => {
                    // The pending activation cleared — perform the deferred upsert.
                    const { hostnameUrl, accessToken, clientSecret, clientToken } = ctx.auth;
                    const auth = { hostnameUrl, accessToken, clientSecret, clientToken };
                    const { entries } = await upsertAndActivate(ctx, auth, {
                        listId: wait.listId,
                        network: wait.network,
                        value: wait.deferred.value,
                        description: wait.deferred.description,
                        ttl: wait.deferred.ttl
                    });
                    return { ...wait, phase: 'awaitActive', output: { entries } };
                },
                onActive: (ctx, wait) => ctx.sendJson(
                    { ...wait.output, activationStatus: ACTIVATION_STATUS.ACTIVE },
                    'out'
                )
            });
        }

        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const auth = { hostnameUrl, accessToken, clientSecret, clientToken };
        const { listId, value, description, ttl, network, waitForActivation, timeout } =
            context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List is required');
        }

        if (!value) {
            throw new context.CancelError('IP or IPs is required');
        }

        // A list already pending activation cannot be re-activated. This is common in
        // rapid sequential additions (e.g. blocking attacker after attacker) where a
        // previous activation is still in flight. The check happens before modifying
        // entries so the non-wait error path leaves the list untouched; with
        // "Wait for Activation" enabled the whole upsert is deferred and performed
        // by a poll continuation once the in-flight activation clears.
        const currentStatus = await lib.getActivationStatus(context, auth, listId, network);
        if (currentStatus === ACTIVATION_STATUS.PENDING) {
            if (!waitForActivation) {
                throw new context.CancelError(
                    `List ${listId} is already PENDING_ACTIVATION on the ${network} network, so it cannot be ` +
                    're-activated yet. Akamai activations can take 1-15+ minutes. Enable "Wait for Activation" ' +
                    'to poll until the current activation completes before adding more entries.'
                );
            }
            return lib.startWait(context, {
                listId,
                network,
                phase: 'awaitClear',
                timeoutSeconds: timeout,
                deferred: { value, description, ttl }
            });
        }

        const { entries, activation } = await upsertAndActivate(
            context, auth, { listId, network, value, description, ttl }
        );

        if (!waitForActivation) {
            return context.sendJson(
                { entries, activationStatus: activation && activation.activationStatus },
                'out'
            );
        }

        // Poll until the activation reaches ACTIVE so downstream steps
        // (e.g. another rapid addition) don't hit a still-pending list.
        return lib.startWait(context, {
            listId,
            network,
            phase: 'awaitActive',
            timeoutSeconds: timeout,
            output: { entries }
        });
    }
};
