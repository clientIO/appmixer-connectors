/**
 * https://win.wiz.io/reference/pull-cloud-resources
 * @type {string}
 */


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

// TODO implement getResources
