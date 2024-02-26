'use strict';

module.exports = {

    async receive(context) {

        return context.sendJson([
            { 'value': 'us-east-1', 'content': 'US East (N. Virginia)' },
            { 'value': 'us-east-2', 'content': 'US East (Ohio)' },
            { 'value': 'us-west-1', 'content': 'US West (N. California)' },
            { 'value': 'us-west-2', 'content': 'US West (Oregon)' },
            { 'value': 'af-south-1', 'content': 'Africa (Cape Town)' },
            { 'value': 'ap-east-1', 'content': 'Asia Pacific (Hong Kong)' },
            { 'value': 'ap-southeast-3', 'content': 'Asia Pacific (Jakarta)' },
            { 'value': 'ap-south-1', 'content': 'Asia Pacific (Mumbai)' },
            { 'value': 'ap-northeast-3', 'content': 'Asia Pacific (Osaka)' },
            { 'value': 'ap-northeast-2', 'content': 'Asia Pacific (Seoul)' },
            { 'value': 'ap-southeast-1', 'content': 'Asia Pacific (Singapore)' },
            { 'value': 'ap-southeast-2', 'content': 'Asia Pacific (Sydney)' },
            { 'value': 'ap-northeast-1', 'content': 'Asia Pacific (Tokyo)' },
            { 'value': 'ca-central-1', 'content': 'Canada (Central)' },
            { 'value': 'eu-central-1', 'content': 'Europe (Frankfurt)' },
            { 'value': 'eu-west-1', 'content': 'Europe (Ireland)' },
            { 'value': 'eu-west-2', 'content': 'Europe (London)' },
            { 'value': 'eu-south-1', 'content': 'Europe (Milan)' },
            { 'value': 'eu-west-3', 'content': 'Europe (Paris)' },
            { 'value': 'eu-north-1', 'content': 'Europe (Stockholm)' },
            { 'value': 'me-south-1', 'content': 'Middle East (Bahrain)' },
            { 'value': 'me-central-1', 'content': 'Middle East (UAE)' },
            { 'value': 'sa-east-1', 'content': 'South America (São Paulo)' }
        ], 'out');
    }
};
