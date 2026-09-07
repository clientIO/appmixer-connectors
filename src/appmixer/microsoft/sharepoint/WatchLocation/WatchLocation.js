const commons = require('../../microsoft-commons');

const getLatestChanges = async (deltaLink, accessToken) => {

    const currentPage = await commons.formatError(() => {
        return commons.get(deltaLink, accessToken);
    });

    if (currentPage['@odata.deltaLink']) {
        return currentPage;
    }

    const nextPage = await getLatestChanges(currentPage['@odata.nextLink'], accessToken);
    nextPage.value = currentPage.value.concat(nextPage.value);

    return nextPage;
};

const createInitialState = async (context) => {

    const { accessToken } = context.auth;
    const { driveId } = context.properties;

    const url = `/drives/${driveId}/items/root/delta`;

    const latest = await getLatestChanges(url, accessToken);

    return {
        deltaLink: latest['@odata.deltaLink']
    };
};

/**
 * Component which triggers whenever a new file is created.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return context.saveState(await createInitialState(context));
    },

    async tick(context) {

        const { accessToken } = context.auth;

        let lock;
        try {
            lock = await context.lock(context.componentId);

            let { deltaLink } = await context.loadState();
            if (!deltaLink) {
                const state = await createInitialState(context);
                deltaLink = state.deltaLink;
            }

            const latestChanges = await getLatestChanges(deltaLink, accessToken);

            await context.saveState({
                deltaLink: latestChanges['@odata.deltaLink']
            });

            const changes = processDelta(latestChanges?.value);

            if (changes.length) {
                await context.sendArray(changes, 'out');
            }

        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    },

    async test(context) {

        const { accessToken } = context.auth;
        const { driveId } = context.properties;

        if (!driveId) {
            throw new context.CancelError('Drive ID is required!');
        }

        // Flow Test Mode: fetch the current delta WITHOUT the baseline deltaLink
        // (which start()/tick() use to suppress already-seen items) so we get the
        // existing files, then emit the most recently modified one. Same fetch +
        // processDelta path tick() uses, so the shape is identical.
        const latestChanges = await getLatestChanges(`/drives/${driveId}/items/root/delta`, accessToken);
        const changes = processDelta(latestChanges?.value);

        if (!changes.length) {
            throw new Error('No files found in the watched location to use as test data.');
        }

        const newest = changes
            .slice()
            .sort((a, b) => new Date(b.lastModifiedDateTime || 0) - new Date(a.lastModifiedDateTime || 0))[0];

        return context.sendJson(newest, 'out');
    }
};

const STATUS = {
    NEW: 'new',
    DELETED: 'deleted',
    MODIFIED: 'modified'
};

/**
 * filter delta to return only modified or new files.
 * delta endpoint returns all changes, including deleted files, however, for the deleted files we don't have useful information -
 * it returns only location where the file has been deleted from + file ID
 * @param deltaValues
 * @returns {*}
 */
const processDelta = function(deltaValues = []) {

    return deltaValues.reduce((res, item) => {

        const { lastModifiedDateTime, createdDateTime, file } = item;
        if (file) {

            let status;
            if (lastModifiedDateTime && createdDateTime && lastModifiedDateTime !== createdDateTime) {
                status = STATUS.MODIFIED;
            }
            if (lastModifiedDateTime && createdDateTime && lastModifiedDateTime === createdDateTime) {
                status = STATUS.NEW;
            }

            res.push({ ...item, status });
        }

        return res;

    }, []);
};


