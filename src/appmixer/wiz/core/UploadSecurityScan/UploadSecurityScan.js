'use strict';
const lib = require('../../lib');

const query = `query RequestSecurityScanUpload($filename: String!) { 
        requestSecurityScanUpload(filename: $filename) { 
            upload { id url systemActivityId } 
        }
    }`;

const statusQuery = `query SystemActivity($id: ID!) {
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

let attempts = 0;
const getStatus = async function(context, id) {

    context.log({ stage: 'getting status', systemActivityId: id, attempts });
    const { data } = await lib.makeApiCall({
        context,
        method: 'POST',
        data: {
            query: statusQuery,
            variables: {
                id
            }
        }
    });

    if (data.errors) {
        attempts++;
        if (attempts <= 5) {
            await new Promise(r => setTimeout(r, 2000));
            return await getStatus(context, id);
        } else {
            throw new context.CancelError(data.errors);
        }
    }

    return data.data.systemActivity;
};

const requestUpload = async function(context, { filename }) {

    const { data } = await lib.makeApiCall({
        context,
        method: 'POST',
        data: {
            query,
            variables: {
                filename
            }
        }
    });

    if (data.errors) {
        throw new context.CancelError(data.errors);
    }

    context.log({ stage: 'request upload response', upload: data.data.requestSecurityScanUpload.upload });

    return data.data.requestSecurityScanUpload.upload;
};

const uploadFile = async function(context, { url, fileContent }) {

    const upload = await context.httpRequest({
        method: 'PUT',
        url,
        data: fileContent, // stream upload is not implemented on the wiz side
        headers: {
            'Content-Type': 'application/json'
        }
    });
    await context.log({ stage: 'upload finished', uploadData: upload.statusCode, fileContent });
};

const createDocument = function(context) {

    const {
        integrationId,
        dataSourceId: id,
        dataSourceAnalysisDate: analysisDate,
        cloudPlatform,
        providerId,
        vulnerabilityFindings
    } = context.messages.in.content;

    return {

        integrationId,
        'dataSources': [{
            id,
            analysisDate,
            'assets': [
                {
                    'assetIdentifier': {
                        cloudPlatform,
                        providerId
                    },
                    'vulnerabilityFindings': vulnerabilityFindings.AND.map(finding => {
                        return { ...finding };
                    })
                }
            ]
        }]
    };
};

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { filename } = context.messages.in.content;

        const { url, systemActivityId } = await requestUpload(context, { filename });
        await context.log({ stage: 'requestUpload response ', url, systemActivityId });

        await uploadFile(context, { url, fileContent: createDocument(context) });

        const status = await getStatus(context, systemActivityId);
        return context.sendJson(status, 'out');
    }
};
