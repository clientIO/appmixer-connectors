'use strict';
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

const itemSchemaWithTitles = {
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

    // docs: https://win.wiz.io/reference/pull-cloud-resources
    async receive(context)   {

        const { outputType, filter, limit = 10 } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, itemSchemaWithTitles);
        }

        let filterBy;
        if (filter) {
            try {
                filterBy = JSON.parse(filter);
            } catch (e) {
                throw new context.CancelError('Invalid Input: Filter', e);
            }
        }
        const { data } = await lib.makeApiCall({
            context,
            method: 'POST',
            data: {
                query,
                variables: {
                    first: limit,
                    filterBy
                }
            }
        });

        if (data.errors) {
            throw new context.CancelError(data.errors);
        }

        context.log({ stage: 'response', data });

        if (data.data.cloudResources.nodes.length === 0) {
            return context.sendJson({ filter: filterBy }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: data.data.cloudResources.nodes, outputType });
    }
};
