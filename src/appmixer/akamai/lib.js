const crypto = require('crypto');
const EdgeGrid = require('akamai-edgegrid');

// Client list activation statuses as returned by the Akamai Network/Client Lists API.
const ACTIVATION_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    MODIFIED: 'MODIFIED',
    PENDING: 'PENDING_ACTIVATION',
    FAILED: 'FAILED'
};

module.exports = {
    ACTIVATION_STATUS,

    generateAuthorizationHeader({ clientToken, clientSecret, accessToken, hostnameUrl, method, path, body, debug }) {
        const eg = new EdgeGrid(clientToken, clientSecret, accessToken, hostnameUrl, debug);

        const auth = eg.auth({
            path,
            method,
            body
        });

        return auth.request;
    },

    // Fetch the raw list details (including its activation status per network).
    async getList(context, auth, listId) {
        const { hostnameUrl, accessToken, clientSecret, clientToken } = auth;
        const {
            url,
            method,
            headers: { Authorization }
        } = this.generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method: 'GET',
            path: `/client-list/v1/lists/${listId}`
        });

        const { data } = await context.httpRequest({
            url,
            method,
            headers: { Authorization }
        });

        return data;
    },

    // Normalize the network input to the STAGING/PRODUCTION enum. Values may
    // come from flow variables in any case; don't break flows over casing.
    normalizeNetwork(context, network) {
        const normalized = String(network || '').trim().toUpperCase();
        if (normalized !== 'PRODUCTION' && normalized !== 'STAGING') {
            throw new context.CancelError(`Invalid network "${network}". Expected STAGING or PRODUCTION.`);
        }
        return normalized;
    },

    // Return the activation status of a list for the given network (STAGING/PRODUCTION).
    async getActivationStatus(context, auth, listId, network) {
        network = this.normalizeNetwork(context, network);
        const list = await this.getList(context, auth, listId);
        const key = network === 'PRODUCTION'
            ? 'productionActivationStatus'
            : 'stagingActivationStatus';
        return list[key];
    },

    // Trigger an activation of the list on the given network.
    async activateList(context, auth, { listId, network, comments }) {
        network = this.normalizeNetwork(context, network);
        const { hostnameUrl, accessToken, clientSecret, clientToken } = auth;
        const body = { action: 'ACTIVATE', network };
        if (comments) {
            body.comments = comments;
        }

        const {
            url,
            method,
            headers: { Authorization }
        } = this.generateAuthorizationHeader({
            hostnameUrl,
            accessToken,
            clientToken,
            clientSecret,
            method: 'POST',
            path: `/client-list/v1/lists/${listId}/activations`,
            body
        });

        try {
            const { data } = await context.httpRequest({
                url,
                method,
                headers: { Authorization },
                data: body
            });
            return data;
        } catch (err) {
            // Akamai rejects activating a list version that is already active on
            // the network — for our purposes that means the goal state is reached.
            const detail = err.response && err.response.data && err.response.data.detail;
            if (err.response && err.response.status === 400 && /already active/i.test(detail || '')) {
                return { listId, network, activationStatus: ACTIVATION_STATUS.ACTIVE };
            }
            throw err;
        }
    },

    // Activation status lookup shared across component instances. The last known
    // status is cached in the service state and a non-blocking lock guarantees
    // that only one caller polls Akamai for a given list+network at a time —
    // N components waiting on the same list produce one API call per tick, not N.
    // Returns null when no fresh status is available yet (another caller holds
    // the poll lock and nothing is cached) — callers should simply retry next tick.
    async getActivationStatusShared(context, auth, listId, network, { maxAgeMs = 30 * 1000 } = {}) {
        network = this.normalizeNetwork(context, network);
        // Service state and locks are service-global — scope the keys by a
        // non-secret hash of the credentials so two Akamai accounts with the
        // same listId never share a cache entry or contend on the lock.
        const authScope = crypto.createHash('sha256')
            .update(`${auth.hostnameUrl}:${auth.clientToken}`)
            .digest('hex')
            .slice(0, 12);
        const cacheKey = `activation-status:${authScope}:${listId}:${network}`;
        const cached = await context.service.stateGet(cacheKey);
        if (cached && (Date.now() - cached.time) < maxAgeMs) {
            return cached.status;
        }

        let lock;
        try {
            lock = await context.lock(`akamai-poll-${authScope}-${listId}-${network}`, { ttl: 60 * 1000, maxRetryCount: 0 });
        } catch (err) {
            // Another component instance is polling this list right now.
            return cached ? cached.status : null;
        }
        try {
            // Re-check the cache — the previous lock holder may have just refreshed it.
            const fresh = await context.service.stateGet(cacheKey);
            if (fresh && (Date.now() - fresh.time) < maxAgeMs) {
                return fresh.status;
            }
            const status = await this.getActivationStatus(context, auth, listId, network);
            await context.service.stateSet(cacheKey, { status, time: Date.now() });
            return status;
        } finally {
            await lock.unlock();
        }
    },

    // ------------------------------------------------------------------------
    // Poll continuations. Long activations (1-15+ minutes) must not block
    // receive() — the engine caps execution time. Instead, a wait is carried in
    // a context.setTimeout message: each poll is a short receive() invocation
    // that checks the status and either resolves the wait or re-schedules
    // itself. The overall timeout is enforced with a deadline in the wait.
    //
    // A wait: { listId, network, phase, timeoutSeconds, deadline, output, deferred }
    //   phase 'awaitClear'  — an earlier activation is still PENDING; once it
    //                         clears, the component's onClear callback performs
    //                         the deferred action and returns the follow-up wait
    //                         (or null when it resolved the wait itself).
    //   phase 'awaitActive' — waiting for the list to reach ACTIVE; the wait
    //                         resolves via the component's onActive callback.
    // ------------------------------------------------------------------------

    POLL_INTERVAL_MS: 60 * 1000,

    // Schedule the first poll of a new wait.
    async startWait(context, wait) {
        const timeoutSeconds = wait.timeoutSeconds || 300;
        await context.setTimeout({
            ...wait,
            timeoutSeconds,
            deadline: Date.now() + timeoutSeconds * 1000
        }, Math.min(this.POLL_INTERVAL_MS, timeoutSeconds * 1000));
    },

    // One poll step, invoked from receive() with the context.setTimeout message.
    // Callbacks:
    //   onClear(context, wait, status) — perform the deferred action, return the
    //                                    follow-up wait (or null when resolved)
    //   onActive(context, wait)        — emit the component output for a resolved wait
    async continueWait(context, { onClear, onActive }) {
        let wait = context.messages.timeout.content;

        const { hostnameUrl, accessToken, clientSecret, clientToken } = context.auth;
        const auth = { hostnameUrl, accessToken, clientSecret, clientToken };

        const status = await this.getActivationStatusShared(context, auth, wait.listId, wait.network);

        if (status !== null) {
            if (wait.phase === 'awaitClear') {
                if (status !== ACTIVATION_STATUS.PENDING) {
                    wait = await onClear(context, wait, status);
                    if (!wait) {
                        return;
                    }
                }
            } else if (status === ACTIVATION_STATUS.ACTIVE) {
                return onActive(context, wait);
            } else if (status === ACTIVATION_STATUS.FAILED) {
                throw new context.CancelError(
                    `Activation of list ${wait.listId} on the ${wait.network} network failed.`
                );
            }
        }

        const remainingMs = wait.deadline - Date.now();
        if (remainingMs <= 0) {
            throw new context.CancelError(
                `Timed out after ${wait.timeoutSeconds}s waiting for list ${wait.listId} to become ACTIVE ` +
                `on the ${wait.network} network. Akamai activations can take 1-15+ minutes; ` +
                'increase the timeout or retry later.'
            );
        }

        await context.setTimeout(wait, Math.min(this.POLL_INTERVAL_MS, remainingMs));
    },

    parseIPs(input) {

        let ips = [];

        if (typeof input === 'string') {
            // Check if the string is a JSON array
            try {
                const parsed = JSON.parse(input);
                if (Array.isArray(parsed)) {
                    ips = parsed;
                } else {
                    ips = input.split(/\s+|,/)
                        .filter(item => item)
                        .map(ip => ip.trim());
                }
            } catch (e) {
                ips = input.split(/\s+|,/)
                    .filter(item => item)
                    .map(ip => ip.trim());
            }
        } else if (Array.isArray(input)) {
            ips = input;
        }

        return ips;
    }

};
