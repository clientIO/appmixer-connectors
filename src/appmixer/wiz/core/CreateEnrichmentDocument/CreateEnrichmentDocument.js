const { generateInspector } = require('./generateInspector');

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

    /*
    Ignore vulnerabilityFindings
    if (vulnerabilityFindings && vulnerabilityFindings.AND.length) {
        asset.vulnerabilityFindings = vulnerabilityFindings.AND.map(finding => {
            return { ...finding };
        });
    }
    */

    // webAppVulnerabilityFindings
    if (type === 'vulnerabilityFindings' && webAppVulnerabilityFindings?.AND?.length) {
        asset.webAppVulnerabilityFindings = webAppVulnerabilityFindings.AND.map(finding => {
            return { ...finding };
        });
    }

    // dataSource
    return {
        id,
        analysisDate,
        assets: [{ ...asset }]
    };
};

module.exports = {

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context) {

        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const fileContent = createDocument(context);
        return context.sendJson({ document: fileContent }, 'out');
    }
};
