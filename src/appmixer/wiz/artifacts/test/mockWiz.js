'use strict';

/**
 * In-process mock of the Wiz API (GraphQL endpoint + signed-upload URL).
 * Attach the returned `httpRequest` as `context.httpRequest`; inspect `state`
 * to assert on the traffic the component generated.
 *
 * Options:
 *   resourcesTotal   - total cloudResources the tenant "has" (Infinity allowed)
 *   pageScript       - array of node counts to return per cloudResources call
 *                      (overrides resourcesTotal; hasNextPage stays true so the
 *                      component's own stop conditions are what terminates)
 *   inProgressPolls  - systemActivity polls reporting IN_PROGRESS before SUCCESS
 *   failStatusForever- systemActivity never leaves IN_PROGRESS
 *   statusErrors     - GraphQL errors every systemActivity poll answers with
 *                      (e.g. [{ message: 'Resource not found' }])
 *   latency          - ms added to every request (simulates a slow tenant)
 */
function createMockWiz(options = {}) {

    const {
        resourcesTotal = 0,
        pageScript = null,
        inProgressPolls = 0,
        failStatusForever = false,
        statusErrors = null,
        latency = 0
    } = options;

    const state = {
        calls: [],
        uploads: [],
        statusPolls: 0,
        uploadRequests: 0,
        resourcePages: 0
    };

    const httpRequest = async (req) => {

        state.calls.push(req);
        if (latency) {
            await new Promise(r => setTimeout(r, latency));
        }

        if (req.method === 'PUT') {
            state.uploads.push(req.data);
            return { statusCode: 200, status: 200 };
        }

        const query = req.data?.query || '';

        if (query.includes('requestSecurityScanUpload')) {
            state.uploadRequests++;
            return {
                data: {
                    data: {
                        requestSecurityScanUpload: {
                            upload: {
                                id: `upload-${state.uploadRequests}`,
                                url: 'https://upload.mock.wiz/signed-url',
                                systemActivityId: `activity-${state.uploadRequests}`
                            }
                        }
                    }
                }
            };
        }

        if (query.includes('systemActivity')) {
            state.statusPolls++;
            if (statusErrors) {
                return { data: { data: { systemActivity: null }, errors: statusErrors } };
            }
            if (failStatusForever || state.statusPolls <= inProgressPolls) {
                return {
                    data: {
                        data: {
                            systemActivity: { id: req.data.variables.id, status: 'IN_PROGRESS' }
                        }
                    }
                };
            }
            return {
                data: {
                    data: {
                        systemActivity: {
                            id: req.data.variables.id,
                            status: 'SUCCESS',
                            result: { dataSources: { incoming: 1, handled: 1 } }
                        }
                    }
                }
            };
        }

        if (query.includes('cloudResources')) {
            const pageIndex = state.resourcePages++;
            const first = req.data.variables.first;
            const after = parseInt(req.data.variables.after, 10) || 0;

            let count;
            let hasNextPage;
            if (pageScript) {
                count = pageScript[Math.min(pageIndex, pageScript.length - 1)];
                hasNextPage = true;
            } else {
                const remaining = resourcesTotal - after;
                count = Math.max(0, Math.min(first, remaining));
                hasNextPage = after + count < resourcesTotal;
            }

            const nodes = Array.from({ length: count }, (_, i) => ({
                id: `res-${after + i}`,
                name: `resource-${after + i}`
            }));
            return {
                data: {
                    data: {
                        cloudResources: {
                            nodes,
                            pageInfo: { hasNextPage, endCursor: String(after + count) }
                        }
                    }
                }
            };
        }

        throw new Error('mockWiz: unexpected request ' + JSON.stringify({
            method: req.method, url: req.url
        }));
    };

    return { httpRequest, state };
}

module.exports = { createMockWiz };
