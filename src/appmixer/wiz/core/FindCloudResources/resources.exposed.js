const lib = require('../../lib');

const query = `
query NetworkExposuresTable($filterBy: NetworkExposureFilters, $first: Int, $after: String) {
    networkExposures(filterBy: $filterBy, first: $first, after: $after) {
      nodes {
        id
        exposedEntity {
          id
          name
          type
        }
        accessibleFrom {
          id
          name
          type
          properties
        }
        sourceIpRange
        destinationIpRange
        portRange
        appProtocols
        networkProtocols
        customIPRanges {
          id
          name
          ipRanges
        }
        firstSeenAt
        applicationEndpoints {
          id
          name
          type
          properties
        }
        type
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
 `;

const outputSchema = {
    id: { type: 'string', title: 'Id' },
    exposedEntity: {
        type: 'object',
        properties: {
            id: { type: 'string', title: 'Exposed Entity.Id' },
            name: { type: 'string', title: 'Exposed Entity.Name' },
            type: { type: 'string', title: 'Exposed Entity.Type' }
        }, title: 'Exposed Entity'
    },
    accessibleFrom: {
        type: 'object',
        properties: {
            id: { type: 'string', title: 'Accessible From.Id' },
            name: { type: 'string', title: 'Accessible From.Name' },
            type: { type: 'string', title: 'Accessible From.Type' },
            properties: {
                type: 'object',
                properties: {
                    _productIDs: { type: 'string', title: 'Accessible From.Properties.Product I Ds' },
                    _vertexID: { type: 'string', title: 'Accessible From.Properties.Vertex I D' },
                    cloudPlatform: { type: 'string', title: 'Accessible From.Properties.Cloud Platform' },
                    cloudProviderURL: { type: 'string', title: 'Accessible From.Properties.Cloud Provider U R L' },
                    creationDate: { type: 'string', title: 'Accessible From.Properties.Creation Date' },
                    externalId: { type: 'string', title: 'Accessible From.Properties.External Id' },
                    fullResourceName: { type: 'null', title: 'Accessible From.Properties.Full Resource Name' },
                    name: { type: 'string', title: 'Accessible From.Properties.Name' },
                    nativeType: { type: 'string', title: 'Accessible From.Properties.Native Type' },
                    providerUniqueId: { type: 'string', title: 'Accessible From.Properties.Provider Unique Id' },
                    region: { type: 'string', title: 'Accessible From.Properties.Region' },
                    resourceGroupExternalId: {
                        type: 'null',
                        title: 'Accessible From.Properties.Resource Group External Id'
                    },
                    status: { type: 'string', title: 'Accessible From.Properties.Status' },
                    subscriptionExternalId: {
                        type: 'string',
                        title: 'Accessible From.Properties.Subscription External Id'
                    },
                    tags: {
                        type: 'object',
                        properties: {
                            'aws:cloudformation:logical-id': {
                                type: 'string',
                                title: 'Accessible From.Properties.Tags.Aws:Cloudformation:Logical-Id'
                            },
                            'aws:cloudformation:stack-id': {
                                type: 'string',
                                title: 'Accessible From.Properties.Tags.Aws:Cloudformation:Stack-Id'
                            },
                            'aws:cloudformation:stack-name': {
                                type: 'string',
                                title: 'Accessible From.Properties.Tags.Aws:Cloudformation:Stack-Name'
                            }
                        }, title: 'Accessible From.Properties.Tags'
                    },
                    updatedAt: { type: 'string', title: 'Accessible From.Properties.Updated At' },
                    wafEnabled: { type: 'boolean', title: 'Accessible From.Properties.Waf Enabled' },
                    zone: { type: 'null', title: 'Accessible From.Properties.Zone' }
                }, title: 'Accessible From.Properties'
            }
        }, title: 'Accessible From'
    },
    sourceIpRange: { type: 'string', title: 'Source Ip Range' },
    destinationIpRange: { type: 'string', title: 'Destination Ip Range' },
    portRange: { type: 'string', title: 'Port Range' },
    appProtocols: {
        type: 'array',
        items: { type: 'string' }, title: 'App Protocols'
    },
    networkProtocols: {
        type: 'array',
        items: { type: 'string' }, title: 'Network Protocols'
    },
    customIPRanges: { type: 'null', title: 'Custom I P Ranges' },
    firstSeenAt: { type: 'string', title: 'First Seen At' },
    applicationEndpoints: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string', title: 'Application Endpoints.Id' },
                name: { type: 'string', title: 'Application Endpoints.Name' },
                type: { type: 'string', title: 'Application Endpoints.Type' },
                properties: {
                    type: 'object',
                    properties: {
                        _productIDs: { type: 'string', title: 'Application Endpoints.Properties.Product I Ds' },
                        _vertexID: { type: 'string', title: 'Application Endpoints.Properties.Vertex I D' },
                        allPorts: { type: 'boolean', title: 'Application Endpoints.Properties.All Ports' },
                        cloudPlatform: { type: 'string', title: 'Application Endpoints.Properties.Cloud Platform' },
                        cloudProviderURL: {
                            type: 'null',
                            title: 'Application Endpoints.Properties.Cloud Provider U R L'
                        },
                        exposureLevel_description: {
                            type: 'string',
                            title: 'Application Endpoints.Properties.Exposure Level Description'
                        },
                        exposureLevel_name: {
                            type: 'string',
                            title: 'Application Endpoints.Properties.Exposure Level Name'
                        },
                        exposureLevel_value: {
                            type: 'number',
                            title: 'Application Endpoints.Properties.Exposure Level Value'
                        },
                        externalId: { type: 'string', title: 'Application Endpoints.Properties.External Id' },
                        finalHost: { type: 'string', title: 'Application Endpoints.Properties.Final Host' },
                        finalPort: { type: 'number', title: 'Application Endpoints.Properties.Final Port' },
                        fullResourceName: {
                            type: 'null',
                            title: 'Application Endpoints.Properties.Full Resource Name'
                        },
                        hasScreenshot: { type: 'boolean', title: 'Application Endpoints.Properties.Has Screenshot' },
                        hasSensitiveData: {
                            type: 'boolean',
                            title: 'Application Endpoints.Properties.Has Sensitive Data'
                        },
                        host: { type: 'string', title: 'Application Endpoints.Properties.Host' },
                        httpContentType: {
                            type: 'string',
                            title: 'Application Endpoints.Properties.Http Content Type'
                        },
                        httpGETStatus: { type: 'string', title: 'Application Endpoints.Properties.Http G E T Status' },
                        httpGETStatusCode: {
                            type: 'number',
                            title: 'Application Endpoints.Properties.Http G E T Status Code'
                        },
                        httpTitleSnippet: {
                            type: 'null',
                            title: 'Application Endpoints.Properties.Http Title Snippet'
                        },
                        name: { type: 'string', title: 'Application Endpoints.Properties.Name' },
                        nativeType: { type: 'null', title: 'Application Endpoints.Properties.Native Type' },
                        path: { type: 'string', title: 'Application Endpoints.Properties.Path' },
                        port: { type: 'number', title: 'Application Endpoints.Properties.Port' },
                        portEnd: { type: 'number', title: 'Application Endpoints.Properties.Port End' },
                        portRange: { type: 'boolean', title: 'Application Endpoints.Properties.Port Range' },
                        portStart: { type: 'number', title: 'Application Endpoints.Properties.Port Start' },
                        portValidationResult: {
                            type: 'string',
                            title: 'Application Endpoints.Properties.Port Validation Result'
                        },
                        protocol: { type: 'null', title: 'Application Endpoints.Properties.Protocol' },
                        protocols: { type: 'string', title: 'Application Endpoints.Properties.Protocols' },
                        providerUniqueId: {
                            type: 'null',
                            title: 'Application Endpoints.Properties.Provider Unique Id'
                        },
                        region: { type: 'null', title: 'Application Endpoints.Properties.Region' },
                        resourceGroupExternalId: {
                            type: 'null',
                            title: 'Application Endpoints.Properties.Resource Group External Id'
                        },
                        severity_description: {
                            type: 'string',
                            title: 'Application Endpoints.Properties.Severity Description'
                        },
                        severity_name: { type: 'string', title: 'Application Endpoints.Properties.Severity Name' },
                        severity_value: { type: 'number', title: 'Application Endpoints.Properties.Severity Value' },
                        status: { type: 'null', title: 'Application Endpoints.Properties.Status' },
                        subscriptionExternalId: {
                            type: 'string',
                            title: 'Application Endpoints.Properties.Subscription External Id'
                        },
                        updatedAt: { type: 'string', title: 'Application Endpoints.Properties.Updated At' },
                        zone: { type: 'null', title: 'Application Endpoints.Properties.Zone' }
                    }, title: 'Application Endpoints.Properties'
                }
            },
            required: [
                'id',
                'name',
                'type',
                'properties'
            ]
        }, title: 'Application Endpoints'
    },
    type: { type: 'string', title: 'Type' }
};

module.exports = {
    schema: outputSchema,
    async getResources(context, { PAGE_SIZE = 500, limit, filterBy }) {

        let nextPageToken = null;
        let totalRecordsCount = 0;
        let records = [];

        do {
            const filter = {
                ...filterBy,
                publicInternetExposureFilters: {
                    hasApplicationEndpoint: true
                }
            };
            const { data } = await lib.makeApiCall({
                context,
                method: 'POST',
                data: {
                    query,
                    variables: {
                        first: Math.min(PAGE_SIZE, limit - totalRecordsCount),
                        after: nextPageToken,
                        filterBy: filter
                    }
                }
            });

            if (data.errors) {
                throw new context.CancelError(data.errors);
            }

            const { pageInfo = {}, nodes } = data.data.networkExposures;

            if (nodes.length === 0) {
                return context.sendJson({ filter }, 'notFound');
            }

            records = records.concat(nodes);
            totalRecordsCount += nodes.length;
            nextPageToken = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        } while (nextPageToken && totalRecordsCount < limit);

        return records;
    }
};
