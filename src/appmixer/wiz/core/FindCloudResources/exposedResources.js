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

module.exports = {
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
                        filterBy: {
                            publicInternetExposureFilters: {
                                hasApplicationEndpoint: true
                            }
                        }
                    }
                }
            });

            if (data.errors) {
                throw new context.CancelError(data.errors);
            }


            const { pageInfo = {}, nodes: pageRecords } = data.data.networkExposures;

            if (pageRecords.length === 0) {
                return context.sendJson({ filter: filterBy }, 'notFound');
            }

            records = records.concat(pageRecords);
            totalRecordsCount += pageRecords.length;
            nextPageToken = pageInfo.endCursor;
        } while (nextPageToken && totalRecordsCount < limit);

        return records;
    }
};
