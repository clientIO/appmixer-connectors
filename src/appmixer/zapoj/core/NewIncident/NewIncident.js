'use strict';

module.exports = {

    async tick(context) {

        // First page of active incidents. Newer incidents are at the top.
        // TODO: Figure out the correct API endpoint for getting the incidents.
        const url = `https://messagetemplate.${context.auth?.subdomain}.zapoj.com/api/itTemplate/list/NI/0`;
        const lastSeenCreatedAt = await context.stateGet('lastSeenCreatedAt');

        if (lastSeenCreatedAt === null) {
            // This is the first run. We are not interested in the existing issues.
            // Just load the first page of latest issues and store them.
            const { data } = await context.httpRequest({
                url: `${url}?page=1`,
                headers: {
                    authorization: `Bearer ${context.auth?.token}`
                }
            });
            const incidents = data.messages.notification.data;
            const latestIncidentCreatedAt = incidents.length ? incidents[0].created_at : 0;
            await context.stateSet('lastSeenCreatedAt', latestIncidentCreatedAt);
        } else {

            // We have already seen some issues and we know the last seen issue.
            // Check the latest issues and compare them with the last seen issue.
            // If all issues are new, we need to load the next page.
            // If some issues are new and some are old, we need to send only the new issues.
            // If all issues are old, we need to stop.
            let shouldLoadNextPage = true;
            let currentPage = 1;
            let incidents = [];
            let newIncidents = [];
            // Failsafe in case the 3rd party API doesn't behave correctly, to prevent infinite loop.
            let failsafe = 0;

            while (shouldLoadNextPage && failsafe < 100) {
                const { data } = await context.httpRequest({
                    url: `${url}?page=${currentPage}`,
                    headers: {
                        authorization: `Bearer ${context.auth?.token}`
                    }
                });

                incidents = incidents.concat(data.messages.notification.data);
                currentPage = data.messages.notification.current_page;
                failsafe += 1;
                const latestIncidentCreatedAt = incidents.length ? incidents[0].created_at : 0;
                if (latestIncidentCreatedAt) {
                    await context.stateSet('lastSeenCreatedAt', latestIncidentCreatedAt);
                }
                // Is there incident that we have already seen?
                const containsOldIncidents = incidents.some(incident => incident.created_at <= lastSeenCreatedAt);
                // Is there incident that we haven't seen?
                const containsNewIncidents = incidents.some(incident => incident.created_at > lastSeenCreatedAt);
                shouldLoadNextPage = containsNewIncidents && !containsOldIncidents;
                newIncidents = incidents.filter(incident => incident.created_at > lastSeenCreatedAt);
            }

            // Send only the new incidents.
            for (const incident of newIncidents) {
                await context.sendJson({ incident }, 'out');
            }
        }
    }
};

