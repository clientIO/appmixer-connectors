/**
 * https://win.wiz.io/reference/pull-cloud-resources
 * @type {string}
 */
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
    'id': { 'type': 'string', 'title': 'Id' },
    'name': { 'type': 'string', 'title': 'Name' },
    'type': { 'type': 'string', 'title': 'Type' },
    'subscriptionId': { 'type': 'string', 'title': 'Subscription Id' },
    'subscriptionExternalId': { 'type': 'string', 'title': 'Subscription External Id' },
    'graphEntity': {
        'type': 'object',
        'properties': {
            'id': { 'type': 'string', 'title': 'Graph Entity.Id' },
            'providerUniqueId': { 'type': 'null', 'title': 'Graph Entity.Provider Unique Id' },
            'name': { 'type': 'string', 'title': 'Graph Entity.Name' },
            'type': { 'type': 'string', 'title': 'Graph Entity.Type' },
            'projects': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': { 'type': 'string', 'title': 'Graph Entity.Projects.Id' }
                    }
                },
                'title': 'Graph Entity.Projects'
            },
            'properties': {
                'type': 'object',
                'properties': {
                    '_environments': { 'type': 'string', 'title': 'Graph Entity.Properties.Environments' },
                    '_productIDs': {
                        'type': 'array',
                        'items': { 'type': 'string' },
                        'title': 'Graph Entity.Properties.Product IDs'
                    },
                    '_vertexID': { 'type': 'string', 'title': 'Graph Entity.Properties.Vertex ID' },
                    'cloudPlatform': { 'type': 'string', 'title': 'Graph Entity.Properties.Cloud Platform' },
                    'description': { 'type': 'null', 'title': 'Graph Entity.Properties.Description' },
                    'externalId': { 'type': 'string', 'title': 'Graph Entity.Properties.External Id' },
                    'name': { 'type': 'string', 'title': 'Graph Entity.Properties.Name' },
                    'namespace': { 'type': 'null', 'title': 'Graph Entity.Properties.Namespace' },
                    'nativeType': { 'type': 'null', 'title': 'Graph Entity.Properties.Native Type' },
                    'providerUniqueId': { 'type': 'null', 'title': 'Graph Entity.Properties.Provider Unique Id' },
                    'region': { 'type': 'null', 'title': 'Graph Entity.Properties.Region' },
                    'subscriptionExternalId': {
                        'type': 'string',
                        'title': 'Graph Entity.Properties.Subscription External Id'
                    }, 'updatedAt': { 'type': 'string', 'title': 'Graph Entity.Properties.Updated At' }
                },
                'title': 'Graph Entity.Properties'
            },
            'firstSeen': { 'type': 'string', 'title': 'Graph Entity.First Seen' },
            'lastSeen': { 'type': 'string', 'title': 'Graph Entity.Last Seen' }
        },
        'title': 'Graph Entity'
    }
};

module.exports = {
    schema: outputSchema,
    async getResources(context, { PAGE_SIZE = 500, limit, filterBy }) {

        let nextPageToken = null;
        let totalRecordsCount = 0;
        let records = [];

        do {
            const { data } = await lib.makeApiCall({
                context,
                method: 'POST',
                data: {
                    query,
                    variables: {
                        first: Math.min(PAGE_SIZE, limit - totalRecordsCount),
                        after: nextPageToken,
                        filterBy: filterBy
                    }
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
