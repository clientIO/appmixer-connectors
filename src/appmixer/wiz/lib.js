const requestSecurityScanUploadQuery = `query RequestSecurityScanUpload($filename: String!) { 
        requestSecurityScanUpload(filename: $filename) { 
            upload { id url systemActivityId } 
        }
    }`;

const systemActivityQuery = `query SystemActivity($id: ID!) {
          systemActivity(id: $id) {
              id
              status
              statusInfo
              result {
                  ...on SystemActivityEnrichmentIntegrationResult{
                      dataSources {
                          ... IngestionStatsDetails
                      }
                      findings {
                          ... IngestionStatsDetails
                      }
                      events {
                          ... IngestionStatsDetails
                      }
                      tags {
                          ...IngestionStatsDetails
          }
                  }
              }
              context {
                  ... on SystemActivityEnrichmentIntegrationContext{
                      fileUploadId
                  }
              }
          }
      }

      fragment IngestionStatsDetails on EnrichmentIntegrationStats {
          incoming
          handled
      }`;

// Upper bounds so a hung Wiz endpoint or a misconfigured connector cannot hold a
// single receive() call for an unbounded amount of time.
const DEFAULT_REQUEST_TIMEOUT = 60 * 1000; // 60s
const MAX_REQUEST_TIMEOUT = 2 * 60 * 1000; // 2 min
const DEFAULT_STATUS_ATTEMPTS = 20;
const MAX_STATUS_ATTEMPTS = 60;
const DEFAULT_STATUS_POLLING_INTERVAL = 3000; // 3s
const MAX_STATUS_POLLING_INTERVAL = 10 * 1000; // 10s
// Total wall-clock budget for one getStatus() polling session. The per-knob caps
// above bound each attempt, but only a joint deadline bounds the whole poll
// (attempts × (request + sleep)) below the engine's receive() timeout.
const MAX_STATUS_TOTAL_TIME = 5 * 60 * 1000; // 5 min
// GraphQL error codes that cannot resolve themselves while we keep polling.
const PERMANENT_STATUS_ERROR_CODES = ['UNAUTHORIZED', 'FORBIDDEN'];

module.exports = {

    // Resolve a bounded HTTP request timeout. Configurable via `requestTimeout`
    // (ms) but always capped so no single request can hang receive() indefinitely.
    getRequestTimeout(context) {

        const configured = parseInt(context?.config?.requestTimeout, 10);
        if (!configured || configured <= 0) {
            return DEFAULT_REQUEST_TIMEOUT;
        }
        return Math.min(configured, MAX_REQUEST_TIMEOUT);
    },

    // Wall-clock deadline for a whole getStatus() polling session. Configurable
    // via `statusMaxTotalTime` (ms) but always capped by MAX_STATUS_TOTAL_TIME.
    getStatusDeadline(context) {

        const configured = parseInt(context?.config?.statusMaxTotalTime, 10);
        const total = (!configured || configured <= 0)
            ? MAX_STATUS_TOTAL_TIME
            : Math.min(configured, MAX_STATUS_TOTAL_TIME);
        return Date.now() + total;
    },

    async makeApiCall({ context, method = 'GET', data }) {

        const url = context.auth.url;

        return context.httpRequest({
            method,
            url,
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${context.auth.token}`
            },
            data,
            timeout: this.getRequestTimeout(context)
        });
    },

    validateUploadStatus(context, { systemActivity }) {

        if (!systemActivity?.status || !systemActivity?.result) {
            throw new context.CancelError('Status activity is not valid', systemActivity);
        }

        if (systemActivity.status !== 'SUCCESS') {
            throw new context.CancelError('Status activity returned error, there is a issue in the security scan', systemActivity);
        }

        Object.keys(systemActivity.result).forEach(key => {
            const { incoming, handled } = systemActivity.result[key];
            if (handled < incoming) {
                throw new context.CancelError(`Invalid result. Not all findings has been handled, '${key}':.`, systemActivity);
            }
        });
    },
    uploadFile: async function(context, { url, fileContent }) {

        const upload = await context.httpRequest({
            method: 'PUT',
            url,
            data: fileContent, // stream upload is not implemented on the wiz side
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: this.getRequestTimeout(context)
        });
        // Do not log the full fileContent: the upload batch can be megabytes and may
        // contain security-findings data. Log only its size/shape instead.
        await context.log({
            stage: 'upload-finished',
            uploadData: upload.status,
            dataSourcesCount: Array.isArray(fileContent?.dataSources) ? fileContent.dataSources.length : undefined
        });
    },

    requestUpload: async function(context, { filename }) {

        const { data } = await this.makeApiCall({
            context,
            method: 'POST',
            data: {
                query: requestSecurityScanUploadQuery,
                variables: {
                    filename
                }
            }
        });

        if (data.errors) {
            throw new context.CancelError(data.errors);
        }

        context.log({ stage: 'upload-requested', upload: data?.data?.requestSecurityScanUpload?.upload });

        return data.data.requestSecurityScanUpload.upload;
    },

    // Human-readable summary of the GraphQL errors of one status poll. Used both
    // for the per-attempt log and for the error thrown once the budget is spent —
    // without it a permanent failure ("Resource not found", a missing API scope)
    // is indistinguishable from a slow upload.
    describeStatusErrors(errors) {

        if (!Array.isArray(errors) || !errors.length) {
            return null;
        }
        return errors.map(error => {
            const code = error?.extensions?.code;
            return code ? `${error.message} (${code})` : error?.message;
        }).filter(Boolean).join('; ');
    },

    getStatus: async function(context, id, options = {}) {

        const { attempts = 0, lastError = null } = options;

        // Both knobs come from connector config; cap them so a large value cannot
        // turn a single receive() into a tens-of-minutes sleep-poll. A caller can
        // pass its own (also capped) budget via options.
        const maxAttempts = Math.min(
            options.maxAttempts
                || parseInt(context.config.statusNumberOfAttempts, 10)
                || DEFAULT_STATUS_ATTEMPTS,
            MAX_STATUS_ATTEMPTS
        );
        const pollingInterval = Math.min(
            options.pollingInterval
                || parseInt(context.config.statusPollingInterval, 10)
                || DEFAULT_STATUS_POLLING_INTERVAL,
            MAX_STATUS_POLLING_INTERVAL
        );
        const deadline = options.deadline || this.getStatusDeadline(context);

        const { data } = await this.makeApiCall({
            context,
            method: 'POST',
            data: {
                query: systemActivityQuery,
                variables: {
                    id
                }
            }
        });

        const errorInfo = this.describeStatusErrors(data?.errors);
        context.log({
            stage: 'retrieving-upload-status',
            systemActivityId: id,
            attempts,
            maxAttempts,
            pollingInterval,
            error: errorInfo || undefined
        });

        // Authorization errors never turn into a result by waiting — fail right away
        // with the service's own message instead of spending the whole poll budget.
        const permanent = (data?.errors || []).find(
            error => PERMANENT_STATUS_ERROR_CODES.includes(error?.extensions?.code));
        if (permanent) {
            throw new context.CancelError(
                `Wiz rejected the status query for systemActivity ${id}: ${permanent.message}`);
        }

        if (data.errors || data?.data?.systemActivity?.status === 'IN_PROGRESS') {
            const nextAttempts = attempts + 1;
            // Retry only while both the attempt budget and the wall-clock deadline
            // allow it — a slow endpoint must not extend the poll past the deadline.
            if (nextAttempts < maxAttempts && Date.now() + pollingInterval < deadline) {
                await new Promise(r => setTimeout(r, pollingInterval));
                return await this.getStatus(context, id, {
                    ...options,
                    attempts: nextAttempts,
                    deadline,
                    lastError: errorInfo || lastError
                });
            }
            const reason = errorInfo || lastError;
            throw new context.CancelError(
                `Exceeded max attempts or time budget for systemActivity: ${id}`
                + (reason ? `. Last error from Wiz: ${reason}` : ''));
        }
        return data?.data?.systemActivity || {};
    }

};

