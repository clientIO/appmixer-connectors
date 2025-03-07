const lib = require('../../lib');

const query = `
query CloudResourceSearch(
    $filterBy: CloudResourceFilters
    $first: Int
    $after: String
  ) {
    cloudResources(
      filterBy: $filterBy
      first: $first
      after: $after
    ) {
      nodes {
        ...CloudResourceFragment
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  fragment CloudResourceFragment on CloudResource {
    id
    name
    type
    subscriptionId
    subscriptionExternalId
    graphEntity{
      id
      providerUniqueId
      name
      type
      projects {
        id
      }
      properties
      firstSeen
      lastSeen
    }
  }
 `;

const outputSchema = {
    id: {
        type: 'string',
        title: 'Id'
    },
    name: {
        type: 'string',
        title: 'Name'
    },
    type: {
        type: 'string',
        title: 'Type'
    },
    subscriptionId: {
        type: 'string',
        title: 'Subscription Id'
    },
    subscriptionExternalId: {
        type: 'string',
        title: 'Subscription External Id'
    },
    graphEntity: {
        type: 'object',
        properties: {
            id: {
                type: 'string',
                title: 'Graph Entity.Id'
            },
            providerUniqueId: {
                type: 'null',
                title: 'Graph Entity.Provider Unique Id'
            },
            name: {
                type: 'string',
                title: 'Graph Entity.Name'
            },
            type: {
                type: 'string',
                title: 'Graph Entity.Type'
            },
            projects: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            title: 'Graph Entity.Projects.Id'
                        }
                    }
                },
                title: 'Graph Entity.Projects'
            },
            properties: {
                type: 'object',
                properties: {
                    _environments: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Environments'
                    },
                    _productIDs: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Product I Ds'
                    },
                    _vertexID: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Vertex I D'
                    },
                    allPorts: {
                        type: 'boolean',
                        title: 'Graph Entity.Properties.All Ports'
                    },
                    cloudPlatform: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Cloud Platform'
                    },
                    cloudProviderURL: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Cloud Provider U R L'
                    },
                    exposureLevel_description: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Exposure Level Description'
                    },
                    exposureLevel_name: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Exposure Level Name'
                    },
                    exposureLevel_value: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Exposure Level Value'
                    },
                    externalId: {
                        type: 'string',
                        title: 'Graph Entity.Properties.External Id'
                    },
                    finalHost: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Final Host'
                    },
                    finalPort: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Final Port'
                    },
                    fullResourceName: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Full Resource Name'
                    },
                    hasScreenshot: {
                        type: 'boolean',
                        title: 'Graph Entity.Properties.Has Screenshot'
                    },
                    host: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Host'
                    },
                    httpContentType: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Http Content Type'
                    },
                    httpGETStatus: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Http G E T Status'
                    },
                    httpGETStatusCode: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Http G E T Status Code'
                    },
                    httpTitleSnippet: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Http Title Snippet'
                    },
                    name: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Name'
                    },
                    nativeType: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Native Type'
                    },
                    path: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Path'
                    },
                    port: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Port'
                    },
                    portEnd: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Port End'
                    },
                    portRange: {
                        type: 'boolean',
                        title: 'Graph Entity.Properties.Port Range'
                    },
                    portStart: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Port Start'
                    },
                    portValidationResult: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Port Validation Result'
                    },
                    protocol: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Protocol'
                    },
                    protocols: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Protocols'
                    },
                    providerUniqueId: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Provider Unique Id'
                    },
                    region: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Region'
                    },
                    resourceGroupExternalId: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Resource Group External Id'
                    },
                    status: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Status'
                    },
                    subscriptionExternalId: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Subscription External Id'
                    },
                    updatedAt: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Updated At'
                    },
                    zone: {
                        type: 'null',
                        title: 'Graph Entity.Properties.Zone'
                    }
                },
                title: 'Graph Entity.Properties'
            },
            firstSeen: {
                type: 'string',
                title: 'Graph Entity.First Seen'
            },
            lastSeen: {
                type: 'string',
                title: 'Graph Entity.Last Seen'
            }
        },
        title: 'Graph Entity'
    }
};
module.exports = {
    schema: outputSchema,
    async getResources(context, { PAGE_SIZE = 500, limit, filterBy }) {

        let nextPageToken = null;
        let totalRecordsCount = 0;
        let records = [];

        do {
            const variables = {
                first: Math.min(PAGE_SIZE, limit - totalRecordsCount),
                filterBy
            };

            if (nextPageToken) {
                variables.after = nextPageToken;
            }

            const { data } = await lib.makeApiCall({
                context,
                method: 'POST',
                data: {
                    query,
                    variables
                }
            });

            if (data.errors) {
                throw new context.CancelError(data.errors);
            }

            const { pageInfo = {}, nodes } = data.data.cloudResources;

            if (nodes.length === 0) {
                return context.sendJson({ filter: filterBy }, 'notFound');
            }

            records = records.concat(nodes);
            totalRecordsCount += nodes.length;
            nextPageToken = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        } while (nextPageToken && totalRecordsCount < limit);

        return records;
    }
};
