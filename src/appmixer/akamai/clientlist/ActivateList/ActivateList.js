'use strict';

const lib = require('../../lib');
const { ACTIVATION_STATUS } = lib;

module.exports = {

    async receive(context) {

        // Poll continuation scheduled by a previous receive() invocation.
        if (context.messages.timeout) {
            return lib.continueWait(context, {
                onClear: async (ctx, wait, status) => {
                    // The pending activation cleared. When it left the list ACTIVE
                    // there is nothing left to activate — resolve right away.
                    if (status === ACTIVATION_STATUS.ACTIVE) {
                        await ctx.sendJson(
                            { ...wait.output, activationStatus: ACTIVATION_STATUS.ACTIVE },
                            'out'
                        );
                        return null;
                    }
                    const { hostnameUrl, accessToken, clientSecret, clientToken } = ctx.auth;
                    const auth = { hostnameUrl, accessToken, clientSecret, clientToken };
                    const data = await lib.activateList(ctx, auth, {
                        listId: wait.listId,
                        network: wait.network,
                        comments: wait.deferred.comments
                    });
                    return {
                        ...wait,
                        phase: 'awaitActive',
                        output: { ...data, previousActivationStatus: wait.output.previousActivationStatus }
                    };
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
        const { listId, network, comments, waitForActivation, timeout } =
            context.messages.in.content;
        if (!listId) {
            throw new context.CancelError('List is required');
        }

        if (!network) {
            throw new context.CancelError('Network is required');
        }

        // Check the current activation status before triggering a new activation.
        const currentStatus = await lib.getActivationStatus(context, auth, listId, network);

        // Already active — Akamai rejects re-activating an unchanged list version,
        // so there is nothing to do.
        if (currentStatus === ACTIVATION_STATUS.ACTIVE) {
            return context.sendJson(
                {
                    listId,
                    network,
                    previousActivationStatus: currentStatus,
                    activationStatus: currentStatus
                },
                'out'
            );
        }

        // A list already pending activation cannot be re-activated. Either defer
        // the activation until the pending one clears (poll continuations take
        // over) or surface a clear error.
        if (currentStatus === ACTIVATION_STATUS.PENDING) {
            if (!waitForActivation) {
                throw new context.CancelError(
                    `List ${listId} is already PENDING_ACTIVATION on the ${network} network. ` +
                    'Akamai activations can take 1-15+ minutes to complete. Enable "Wait for Activation" ' +
                    'or retry once the current activation finishes.'
                );
            }
            return lib.startWait(context, {
                listId,
                network,
                phase: 'awaitClear',
                timeoutSeconds: timeout,
                deferred: { comments },
                output: { listId, network, previousActivationStatus: currentStatus }
            });
        }

        const data = await lib.activateList(context, auth, { listId, network, comments });

        if (!waitForActivation) {
            return context.sendJson(
                { ...data, previousActivationStatus: currentStatus },
                'out'
            );
        }

        // Poll until the activation reaches ACTIVE so downstream steps don't
        // proceed on a still-pending list.
        return lib.startWait(context, {
            listId,
            network,
            phase: 'awaitActive',
            timeoutSeconds: timeout,
            output: { ...data, previousActivationStatus: currentStatus }
        });
    }
};
