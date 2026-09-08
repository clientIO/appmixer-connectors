'use strict';
const lib = require('../../lib');
const { generateInspector } = require('./generateInspector');

const query = `query RequestSecurityScanUpload($filename: String!) { 
        requestSecurityScanUpload(filename: $filename) { 
            upload { id url systemActivityId } 
        }
    }`;

// This component keeps a deliberately short poll (5 attempts x 2s) instead of the
// connector-configurable budget lib.getStatus uses by default: a security scan
// upload is expected to be acknowledged quickly and receive() must not block.
const STATUS_ATTEMPTS = 5;
const STATUS_POLLING_INTERVAL = 2000;

const getStatus = async function(context, id) {

    const systemActivity = await lib.getStatus(context, id, {
        maxAttempts: STATUS_ATTEMPTS,
        pollingInterval: STATUS_POLLING_INTERVAL
    });

    // throw error if the system activity is not valid.
    lib.validateUploadStatus(context, { systemActivity });

    return systemActivity;
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

    context.log({ stage: 'upload-requested', upload: data?.data?.requestSecurityScanUpload?.upload });

    return data.data.requestSecurityScanUpload.upload;
};

const uploadFile = async function(context, { url, fileContent }) {

    const upload = await context.httpRequest({
        method: 'PUT',
        url,
        data: fileContent, // stream upload is not implemented on the wiz side
        headers: {
            'Content-Type': 'application/json'
        },
        timeout: lib.getRequestTimeout(context)
    });
    // Do not log the full fileContent: the upload batch can be megabytes and may
    // contain security-findings data. Log only its size/shape instead.
    await context.log({
        stage: 'upload-finished',
        uploadData: upload.status,
        dataSourcesCount: Array.isArray(fileContent?.dataSources) ? fileContent.dataSources.length : undefined
    });
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
        // vulnerabilityFindings,
        webAppVulnerabilityFindings,
        events
    } = context.messages.in.content;

    const { type } = context.properties;

    const asset = {
        assetIdentifier: {
            cloudPlatform,
            providerId
        }
    };

    if (type === 'events' && events?.AND?.length) {
        asset.events = normalizeEvents(events.AND);
    }

    if (type === 'vulnerabilityFindings' && webAppVulnerabilityFindings?.AND?.length) {
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
        const fileContent = createDocument(context);
        await uploadFile(context, { url, fileContent });
        const status = await getStatus(context, systemActivityId);
        return context.sendJson(status, 'out');
    }
};
