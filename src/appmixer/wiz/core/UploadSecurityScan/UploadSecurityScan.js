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

async function streamToString(stream) {
    // lets have a ReadableStream as a stream variable
    const chunks = [];

    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf-8');
}

const uploadFile = async function(context, { url, fileContent }) {

    const upload = await context.httpRequest({
        method: 'PUT',
        url,
        data: fileContent, // stream upload is not implemented on the wiz side
        headers: {
            'Content-Type': 'application/json'
        }
    });
    context.log({ stage: 'upload finished', uploadData: upload.statusCode });
};

const getFile = async function(context) {

    const { filename, fileId, fileContent } = context.messages.in.content;

    let json;
    let name;
    if (fileId) {
        const fileInfo = await context.getFileInfo(fileId);
        const stream = await context.getFileReadStream(fileId);
        json = await streamToString(stream);
        name = filename || fileInfo.filename;
    } else {
        try {
            json = JSON.parse(fileContent);
            name = filename || 'incident-report.json';
        } catch (e) {
            throw new context.CancelError('Invalid Input: FileContent', e);
        }
    }

    return { content: json, name };
};

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        const { name, fileContent } = await getFile(context);

        const { url, systemActivityId } = await requestUpload(context, { filename: name });
        context.log({ stage: 'requestUpload response ', url, systemActivityId });

        await uploadFile(context, { url, fileContent });

        const status = await getStatus(context, systemActivityId);
        return context.sendJson(status, 'out');
    }
};
