const delta = require('../../microsoft-delta');

const STATUS = {
    NEW: 'new',
    DELETED: 'deleted',
    MODIFIED: 'modified'
};

/**
 * Keep the file items of a delta page (folders and other items without a `file` facet are
 * dropped) and classify each one: `new` when it was never modified after it was created,
 * `modified` otherwise. Items without both timestamps - typically deleted files, for which the
 * delta endpoint returns little more than the ID and the location they were deleted from -
 * are kept with `status` left undefined.
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

const getDeltaPath = (context) => {

    const { driveId } = context.properties;
    return `/drives/${driveId}/items/root/delta`;
};

/**
 * Establish the delta baseline. `?token=latest` gives us the current delta token without
 * enumerating the whole location, so neither start() nor tick() has to page through every
 * existing file just to find out where "now" is.
 * @param {Context} context
 * @return {Promise<string>}
 */
const getBaselineDeltaLink = async (context) => {

    return delta.fetchLatestDeltaLink(getDeltaPath(context), context.auth.accessToken);
};

/**
 * Component which triggers whenever a new file is created.
 * @extends {Component}
 */
module.exports = {

    async start(context) {

        return context.saveState({ deltaLink: await getBaselineDeltaLink(context) });
    },

    async tick(context) {

        return delta.runDeltaScan(context, {
            startLink: async (state) => state.deltaLink || await getBaselineDeltaLink(context),
            baseline: () => getBaselineDeltaLink(context),
            onPage: async (items) => {
                const changes = processDelta(items);
                if (changes.length) {
                    await context.sendArray(changes, 'out');
                }
            },
            // Persisted only AFTER the page has been emitted: a crash then replays the page
            // instead of silently dropping it, which is the safer of the two failure modes.
            saveProgress: async (link) => context.stateSet('deltaLink', link)
        });
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
        const { items } = await delta.fetchDeltaPages(getDeltaPath(context), accessToken, {
            maxPages: delta.TEST_MODE_MAX_PAGES
        });
        const changes = processDelta(items);

        if (!changes.length) {
            throw new Error('No files found in the watched location to use as test data.');
        }

        const newest = changes
            .slice()
            .sort((a, b) => new Date(b.lastModifiedDateTime || 0) - new Date(a.lastModifiedDateTime || 0))[0];

        return context.sendJson(newest, 'out');
    }
};
