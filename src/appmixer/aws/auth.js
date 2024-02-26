'use strict';
const AWS = require('aws-sdk');

module.exports = {

    type: 'apiKey',

    definition: {

        accountNameFromProfileInfo: 'accessKeyId',

        auth: {
            accessKeyId: {
                type: 'text',
                name: 'Access Key Id',
                tooltip: 'Your AWS access key ID'
            },
            secretKey: {
                type: 'text',
                name: 'Secret Key',
                tooltip: 'Your AWS secret access key'
            }
        },

        validate: async context => {

            AWS.config.update({
                credentials: {
                    accessKeyId: context.accessKeyId,
                    secretAccessKey: context.secretKey
                }
            });

            const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
            return s3.listBuckets().promise();
        }
    }
};
