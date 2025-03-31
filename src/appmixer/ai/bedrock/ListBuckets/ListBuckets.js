'use strict';

const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

module.exports = {

    async receive(context) {

        const { region } = context.messages.in.content;

        const s3Client = new S3Client({
            region: region || 'us-east-1',
            credentials: {
                accessKeyId: context.auth.accessKeyId,
                secretAccessKey: context.auth.secretKey
            }
        });

        const response = await s3Client.send(new ListBucketsCommand({}));
        return context.sendJson({ buckets: response.Buckets }, 'out');
    },

    toSelectArray(out) {

        const buckets = out.buckets;
        if (buckets && Array.isArray(buckets)) {
            return buckets.map(bucket => ({
                label: bucket.Name,
                value: bucket.Name
            }));
        }
        return [];
    }
};
