'use strict';

module.exports = {

    async receive(context) {

        // https://docs.aws.amazon.com/bedrock/latest/userguide/features-regions.html
        // Not every Bedrock feature is available in every region.
        return context.sendJson([
            { 'content': 'US East (Ohio) [us-east-2]', 'value': 'us-east-2' },
            { 'content': 'US East (N. Virginia) [us-east-1]', 'value': 'us-east-1' },
            { 'content': 'US West (N. California) [us-west-1]', 'value': 'us-west-1' },
            { 'content': 'US West (Oregon) [us-west-2]', 'value': 'us-west-2' },
            { 'content': 'Africa (Cape Town) [af-south-1]', 'value': 'af-south-1' },
            { 'content': 'Asia Pacific (Hong Kong) [ap-east-1]', 'value': 'ap-east-1' },
            { 'content': 'Asia Pacific (Hyderabad) [ap-south-2]', 'value': 'ap-south-2' },
            { 'content': 'Asia Pacific (Jakarta) [ap-southeast-3]', 'value': 'ap-southeast-3' },
            { 'content': 'Asia Pacific (Melbourne) [ap-southeast-4]', 'value': 'ap-southeast-4' },
            { 'content': 'Asia Pacific (Mumbai) [ap-south-1]', 'value': 'ap-south-1' },
            { 'content': 'Asia Pacific (Osaka) [ap-northeast-3]', 'value': 'ap-northeast-3' },
            { 'content': 'Asia Pacific (Seoul) [ap-northeast-2]', 'value': 'ap-northeast-2' },
            { 'content': 'Asia Pacific (Singapore) [ap-southeast-1]', 'value': 'ap-southeast-1' },
            { 'content': 'Asia Pacific (Sydney) [ap-southeast-2]', 'value': 'ap-southeast-2' },
            { 'content': 'Asia Pacific (Tokyo) [ap-northeast-1]', 'value': 'ap-northeast-1' },
            { 'content': 'Canada (Central) [ca-central-1]', 'value': 'ca-central-1' },
            { 'content': 'Europe (Frankfurt) [eu-central-1]', 'value': 'eu-central-1' },
            { 'content': 'Europe (Ireland) [eu-west-1]', 'value': 'eu-west-1' },
            { 'content': 'Europe (London) [eu-west-2]', 'value': 'eu-west-2' },
            { 'content': 'Europe (Milan) [eu-south-1]', 'value': 'eu-south-1' },
            { 'content': 'Europe (Paris) [eu-west-3]', 'value': 'eu-west-3' },
            { 'content': 'Europe (Spain) [eu-south-2]', 'value': 'eu-south-2' },
            { 'content': 'Europe (Stockholm) [eu-north-1]', 'value': 'eu-north-1' },
            { 'content': 'Europe (Zurich) [eu-central-2]', 'value': 'eu-central-2' },
            { 'content': 'Middle East (Bahrain) [me-south-1]', 'value': 'me-south-1' },
            { 'content': 'Middle East (UAE) [me-central-1]', 'value': 'me-central-1' },
            { 'content': 'South America (São Paulo) [sa-east-1]', 'value': 'sa-east-1' },
            { 'content': 'AWS GovCloud (US-East) [us-gov-east-1]', 'value': 'us-gov-east-1' },
            { 'content': 'AWS GovCloud (US-West) [us-gov-west-1]', 'value': 'us-gov-west-1' }
        ], 'out');
    }
};
