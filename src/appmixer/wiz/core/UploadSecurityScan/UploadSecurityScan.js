'use strict';
const lib = require('../../lib');
const { generateInspector } = require('./generateInspector');

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

    context.log({ stage: 'GETTING STATUS', systemActivityId: id, attempts });
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

    if (data.errors || data?.data?.systemActivity?.status === 'IN_PROGRESS') {
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

    context.log({ stage: 'UPLOAD SUCCESS', upload: data?.data?.requestSecurityScanUpload?.upload });

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
    await context.log({ stage: 'UPLOAD FINISHED', uploadData: upload.statusCode, fileContent });
};

const normalizeEvents = function(events) {

    return events.map(event => {
        return {
            ...event,
            mitreTacticIds: event.mitreTacticIds.split(',').map(item => item.trim()),
            mitreTechniqueIds: event.mitreTechniqueIds.split(',').map(item => item.trim())
        };
    });
};

const createDocument = function(context) {

    const {
        integrationId,
        dataSourceId: id,
        dataSourceAnalysisDate: analysisDate,
        cloudPlatform,
        providerId,
        vulnerabilityFindings,
        webAppVulnerabilityFindings,
        events
    } = context.messages.in.content;

    const asset = {
        assetIdentifier: {
            cloudPlatform,
            providerId
        }
    };

    if (events && events.AND.length) {
        asset.events = normalizeEvents(events.AND);
    }

    if (vulnerabilityFindings && vulnerabilityFindings.AND.length) {
        asset.vulnerabilityFindings = vulnerabilityFindings.AND.map(finding => {
            return { ...finding };
        });
    }
    if (webAppVulnerabilityFindings && webAppVulnerabilityFindings.AND.length) {
        asset.webAppVulnerabilityFindings = webAppVulnerabilityFindings.AND.map(finding => {
            return { ...finding };
        });
    }

    return {
        integrationId,
        dataSources: [{
            id,
            analysisDate,
            assets: [{ ...asset }]
        }]
    };
};

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { filename } = context.messages.in.content;

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const { url, systemActivityId } = await requestUpload(context, { filename });
        await context.log({ stage: 'REQUEST UPLOAD SUCCESS', url, systemActivityId });

        await uploadFile(context, { url, fileContent: createDocument(context) });

        const status = await getStatus(context, systemActivityId);
        return context.sendJson(status, 'out');
    }
};
