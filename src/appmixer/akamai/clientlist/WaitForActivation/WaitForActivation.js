'use strict';

const lib = require('../../lib');
const { ACTIVATION_STATUS } = lib;

module.exports = {

    async receive(context) {

        // Poll continuation scheduled by a previous receive() invocation.
        if (context.messages.timeout) {
            return lib.continueWait(context, {
                onActive: (ctx, wait) => ctx.sendJson(
                    { ...wait.output, activationStatus: ACTIVATION_STATUS.ACTIVE },
                    'out'
                )
            });
        }

        const { hostnameUrl, accessToken, clientSecret, clientToken } =
            context.auth;
        const auth = { hostnameUrl, accessToken, clientSecret, clientToken };
        const { listId, network, timeout } = context.messages.in.content;

        if (!listId) {
            throw new context.CancelError('List is required');
        }

        if (!network) {
            throw new context.CancelError('Network is required');
        }

        // Resolve immediately when the list is already in a final state,
        // otherwise schedule a poll continuation.
        const status = await lib.getActivationStatus(context, auth, listId, network);
        if (status === ACTIVATION_STATUS.ACTIVE) {
            return context.sendJson({ listId, network, activationStatus: status }, 'out');
        }
        if (status === ACTIVATION_STATUS.FAILED) {
            throw new context.CancelError(`Activation of list ${listId} on the ${network} network failed.`);
        }

        return lib.startWait(context, {
            listId,
            network,
            phase: 'awaitActive',
            timeoutSeconds: timeout,
            output: { listId, network }
        });
    }
};
