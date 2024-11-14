module.exports = {
    async receive(context) {

        try {
            const { propertyId } = context.properties;

            // context.log({ step: 'context.properties: ', properties: context.properties });

            //const propertyId = 465510564;

            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`,
                headers: {
                    'Authorization': `Bearer ${context.auth.accessToken}`
                }
            });

            return context.sendJson(data, 'out');
        } catch (error) {
            if (context.properties.variableFetch) {
                return context.sendJson({ dimensions: [], metrics: [] }, 'out');
            }
            context.log({ stage: 'Error', err });
            throw new Error('Property ID must be filled');
        }

    },

    dimensionsToMultiselectArray({ dimensions }) {
        return dimensions.map(dimension => {
            return { label: dimension.uiName, value: dimension.apiName };
        });
    },

    metricsToMultiselectArray({ metrics }) {
        return metrics.map(metric => {
            return { label: metric.uiName, value: metric.apiName };
        });
    },

    dimensionsAndMetricsArray({ dimensions, metrics }) {
        const metricsArr = metrics.map(metric => {
            return { label: metric.uiName, value: metric.apiName };
        });
        const dimensionsArr = dimensions.map(dimension => {
            return { label: dimension.uiName, value: dimension.apiName };
        });

        return dimensionsArr.concat(metricsArr);
    }
};
