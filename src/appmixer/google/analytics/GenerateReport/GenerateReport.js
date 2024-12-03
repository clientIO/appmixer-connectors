'use strict';

/**
 * Component which generates report from Google Analytics 4
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { dateRanges, dimensions, metrics, customDateRanges, limit, keepEmptyRows } = context.messages.in.content;
        const { propertyId } = context.properties;

        let dateRangesArr = [];

        switch (dateRanges) {
            case 'yesterday':
                dateRangesArr.push({
                    startDate: 'yesterday',
                    endDate: 'yesterday'
                });
                break;
            case 'lastSevenDays':
                dateRangesArr.push({
                    startDate: '7daysAgo',
                    endDate: 'yesterday'
                });
                break;
            case 'last28Days':
                dateRangesArr.push({
                    startDate: '28daysAgo',
                    endDate: 'yesterday'
                });
                break;
            case 'last30Days':
                dateRangesArr.push({
                    startDate: '30daysAgo',
                    endDate: 'yesterday'
                });
                break;
            case 'custom':
                dateRangesArr = customDateRanges.ADD.map(({ startDate, endDate }) => ({
                    startDate,
                    endDate
                }));
                break;
            default:
                dateRangesArr.push({
                    startDate: '7daysAgo',
                    endDate: 'yesterday'
                });
        }
        const dimensionsArr = dimensions.map(d => {
            return { name: d };
        });

        const metricsArr = metrics.map(m => {
            return { name: m };
        });

        const body = {
            dimensions: dimensionsArr,
            metrics: metricsArr,
            dateRanges: dateRangesArr,
            limit: limit ?? 10000,
            keepEmptyRows
        };

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: body
        });

        return context.sendJson(data, 'out');
    }
};
