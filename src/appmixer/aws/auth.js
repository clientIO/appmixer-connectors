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
            try {
                await s3.listBuckets().promise();
            } catch (err) {
                // If the error is:
                //  User is not authorized to perform: s3:ListAllMyBuckets because no identity-based policy allows the s3:ListAllMyBuckets action
                // we can continue, as the user may not have permissions to list buckets.
                // This permission is not required for most operations.
                if (err.code === 'AccessDenied' && err.message.includes('s3:ListAllMyBuckets')) {
                    return;
                }

                // Otherwise, throw the error.
                throw err;
            }
        }
    }
};
