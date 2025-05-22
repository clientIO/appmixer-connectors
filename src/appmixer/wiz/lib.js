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

module.exports = {

    async makeApiCall({ context, method = 'GET', data }) {

        const url = context.auth.url;

        return context.httpRequest({
            method,
            url,
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${context.auth.token}`
            },
            data
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
            }
        });
        await context.log({ stage: 'upload-finished', uploadData: upload.statusCode, fileContent });
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

    getStatus: async function(context, id, attempts = 0) {

        const maxAttempts = parseInt(context.config.statusNumberOfAttempts , 10) || 20;
        const pollingInterval = parseInt(context.config.statusPollingInterval, 10) || 3000;

        context.log({ stage: 'retrieving-upload-status', systemActivityId: id, attempts, maxAttempts, pollingInterval });
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

        if (data.errors || data?.data?.systemActivity?.status === 'IN_PROGRESS') {
            attempts++;
            if (attempts <= maxAttempts) {
                await new Promise(r => setTimeout(r, pollingInterval));
                return await this.getStatus(context, id, attempts);
            } else {
                throw new context.CancelError(`Exceeded max attempts systemActivity: ${id}`);
            }
        }
        return data?.data?.systemActivity || {};
    }

};

