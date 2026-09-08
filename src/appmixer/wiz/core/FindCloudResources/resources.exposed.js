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
                        title: 'Graph Entity.Properties.Product IDs'
                    },
                    _vertexID: {
                        type: 'string',
                        title: 'Graph Entity.Properties.Vertex ID'
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
                        title: 'Graph Entity.Properties.Cloud Provider URL'
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
                        title: 'Graph Entity.Properties.Http GET Status'
                    },
                    httpGETStatusCode: {
                        type: 'number',
                        title: 'Graph Entity.Properties.Http GET Status Code'
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
// Default and hard cap for the number of records fetched in a single receive().
// Without a cap a large `limit` fans out one message per record downstream and
// keeps the component paginating (500/page) for the whole duration of receive().
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 10000;

module.exports = {
    schema: outputSchema,
    // Always returns an array of records (possibly empty). The caller decides how
    // to route an empty result so we never mix a `notFound` response with the
    // records already accumulated on earlier pages.
    async getResources(context, { PAGE_SIZE = 500, limit, filterBy }) {

        // Clamp to [1, MAX_LIMIT] — a zero/negative/non-numeric limit falls back
        // to the default instead of leaking an invalid `first` into the GraphQL query.
        const parsedLimit = parseInt(limit, 10);
        const effectiveLimit = Math.min(parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT, MAX_LIMIT);

        let nextPageToken = null;
        let totalRecordsCount = 0;
        let records = [];

        do {
            const variables = {
                first: Math.min(PAGE_SIZE, effectiveLimit - totalRecordsCount),
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

            const { pageInfo = {}, nodes = [] } = data.data.cloudResources;

            if (nodes.length === 0) {
                // No more results on this page; stop and return whatever we have.
                break;
            }

            records = records.concat(nodes);
            totalRecordsCount += nodes.length;
            nextPageToken = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        } while (nextPageToken && totalRecordsCount < effectiveLimit);

        return records.slice(0, effectiveLimit);
    }
};
