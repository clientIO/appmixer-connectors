'use strict';

module.exports = {

    async receive(context) {

        // Taken from https://docs.aws.amazon.com/general/latest/gr/lambda-service.html#lambda_region
        return context.sendJson([
            { 'content': 'US East (Ohio)', 'value': 'us-east-2' },
            { 'content': 'US East (N. Virginia)', 'value': 'us-east-1' },
            { 'content': 'US West (N. California)', 'value': 'us-west-1' },
            { 'content': 'US West (Oregon)', 'value': 'us-west-2' },
            { 'content': 'Africa (Cape Town)', 'value': 'af-south-1' },
            { 'content': 'Asia Pacific (Hong Kong)', 'value': 'ap-east-1' },
            { 'content': 'Asia Pacific (Hyderabad)', 'value': 'ap-south-2' },
            { 'content': 'Asia Pacific (Jakarta)', 'value': 'ap-southeast-3' },
            { 'content': 'Asia Pacific (Melbourne)', 'value': 'ap-southeast-4' },
            { 'content': 'Asia Pacific (Mumbai)', 'value': 'ap-south-1' },
            { 'content': 'Asia Pacific (Osaka)', 'value': 'ap-northeast-3' },
            { 'content': 'Asia Pacific (Seoul)', 'value': 'ap-northeast-2' },
            { 'content': 'Asia Pacific (Singapore)', 'value': 'ap-southeast-1' },
            { 'content': 'Asia Pacific (Sydney)', 'value': 'ap-southeast-2' },
            { 'content': 'Asia Pacific (Tokyo)', 'value': 'ap-northeast-1' },
            { 'content': 'Canada (Central)', 'value': 'ca-central-1' },
            { 'content': 'Europe (Frankfurt)', 'value': 'eu-central-1' },
            { 'content': 'Europe (Ireland)', 'value': 'eu-west-1' },
            { 'content': 'Europe (London)', 'value': 'eu-west-2' },
            { 'content': 'Europe (Milan)', 'value': 'eu-south-1' },
            { 'content': 'Europe (Paris)', 'value': 'eu-west-3' },
            { 'content': 'Europe (Spain)', 'value': 'eu-south-2' },
            { 'content': 'Europe (Stockholm)', 'value': 'eu-north-1' },
            { 'content': 'Europe (Zurich)', 'value': 'eu-central-2' },
            { 'content': 'Middle East (Bahrain)', 'value': 'me-south-1' },
            { 'content': 'Middle East (UAE)', 'value': 'me-central-1' },
            { 'content': 'South America (São Paulo)', 'value': 'sa-east-1' },
            { 'content': 'AWS GovCloud (US-East)', 'value': 'us-gov-east-1' },
            { 'content': 'AWS GovCloud (US-West)', 'value': 'us-gov-west-1' }
        ], 'out');
    }
};
