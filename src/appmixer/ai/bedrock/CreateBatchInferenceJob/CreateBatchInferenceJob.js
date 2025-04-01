'use strict';

const {
    BedrockClient,
    CreateModelInvocationJobCommand,
    GetModelInvocationJobCommand
} = require('@aws-sdk/client-bedrock');

module.exports = {

    receive: async function(context) {

        // Time before the next receive() is run after the previous one was jumped out of with timeout.
        // We set 1 minute by default which is the minimum we can set for a timeout in Appmixer anyway.
        const JOB_POLL_TIMEOUT_SECONDS = parseInt(context.config.jobPollTimeoutSeconds) || 60;

        if (context.messages.timeout) {
            // Polling for job result.
            let { job, input } = context.messages.timeout.content;
            const client = new BedrockClient({
                region: input.region || 'us-east-1',
                credentials: {
                    accessKeyId: context.auth.accessKeyId,
                    secretAccessKey: context.auth.secretKey
                }
            });
            // https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock/command/GetModelInvocationJobCommand/
            const command = new GetModelInvocationJobCommand({ jobIdentifier: job.jobArn });

            try {
                job = await client.send(command);
            } catch (err) {
                // Re-throw with just the error message. Otherwise a
                // [unable to serialize, circular reference is too complex to analyze]
                // error is thrown.
                throw new context.CancelError(err.message);
            }
            switch (job.status) {
                case 'Completed':
                    return context.sendJson({ job, input }, 'out');
                case 'PartiallyCompleted':
                    await context.log({
                        step: 'job-partially-completed',
                        message: 'This job has partially completed. Not all of your records could be processed in time. View the output files in the output S3 location.',
                        job
                    });
                    return context.sendJson({ job, input }, 'out');
                case 'Stopping':
                    return context.log({ step: 'job-stopping', message: 'This job is being stopped by a user.', job });
                case 'Stopped':
                    return context.log({ step: 'job-stopped', message: 'This job was stopped by a user.', job });
                case 'Failed':
                    throw new context.CancelError(`Job failed. Details: ${JSON.stringify(job)}`);
                case 'Expired':
                    throw new context.CancelError(`Job expired. Details: ${JSON.stringify(job)}`);
                case 'Submitted':
                case 'InProgress':
                case 'Scheduled':
                case 'Validating':
                    return context.setTimeout({ job, input }, JOB_POLL_TIMEOUT_SECONDS * 1000);
                default:
                    return context.setTimeout({ job, input }, JOB_POLL_TIMEOUT_SECONDS * 1000);
            }
        }

        const input = context.messages.in.content;
        const {
            jobName,
            roleArn,
            s3InputObjectBucket,
            s3InputObjectKey,
            s3OutputObjectBucket,
            s3OutputObjectKey,
            region,
            model
        } = input;

        const client = new BedrockClient({
            region: region || 'us-east-1',
            credentials: {
                accessKeyId: context.auth.accessKeyId,
                secretAccessKey: context.auth.secretKey
            }
        });

        const params = {
            jobName,
            roleArn,
            modelId: model,
            inputDataConfig: {
                s3InputDataConfig: {
                    s3Uri: `s3://${s3InputObjectBucket}/${s3InputObjectKey}`
                }
            },
            outputDataConfig: {
                s3OutputDataConfig: {
                    s3Uri: `s3://${s3OutputObjectBucket}/${s3OutputObjectKey}`
                }
            }
        };

        const command = new CreateModelInvocationJobCommand(params);
        let job;
        try {
            job = await client.send(command);
        } catch (err) {
            // Re-throw with just the error message. Otherwise a
            // [unable to serialize, circular reference is too complex to analyze]
            // error is thrown.
            throw new context.CancelError(err.message);
        }

        await context.sendJson({ job, input }, 'job');

        // Start polling for job result.
        return context.setTimeout({ job, input }, JOB_POLL_TIMEOUT_SECONDS * 1000);
    }
};
