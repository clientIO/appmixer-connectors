'use strict';

const { CreateAgentRuntimeCommand } = require('@aws-sdk/client-bedrock-agentcore-control');
const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            agentRuntimeName,
            artifactType,
            containerUri,
            codeS3Bucket,
            codeS3Prefix,
            codeS3VersionId,
            codeRuntime,
            codeEntryPoint,
            roleArn,
            networkMode,
            serverProtocol,
            description,
            environmentVariables
        } = context.messages.in.content;

        if (!agentRuntimeName) {
            throw new context.CancelError('Name is required!');
        }
        if (!roleArn) {
            throw new context.CancelError('Role ARN is required!');
        }

        // Default to container mode so existing flows keep working unchanged.
        const mode = artifactType || 'container';

        let agentRuntimeArtifact;
        if (mode === 'code') {
            if (!codeS3Bucket) {
                throw new context.CancelError('Code S3 Bucket is required in Code artifact mode!');
            }
            if (!codeS3Prefix) {
                throw new context.CancelError('Code S3 Prefix is required in Code artifact mode!');
            }
            if (!codeRuntime) {
                throw new context.CancelError('Managed Runtime is required in Code artifact mode!');
            }
            // entryPoint is a list; accept a single value or a comma-separated list.
            const entryPoint = (codeEntryPoint || 'main.py')
                .split(',')
                .map(part => part.trim())
                .filter(part => part.length);
            if (!entryPoint.length) {
                throw new context.CancelError('Code Entry Point is required in Code artifact mode!');
            }
            const s3 = { bucket: codeS3Bucket, prefix: codeS3Prefix };
            if (codeS3VersionId) {
                s3.versionId = codeS3VersionId;
            }
            agentRuntimeArtifact = {
                codeConfiguration: {
                    code: { s3 },
                    runtime: codeRuntime,
                    entryPoint
                }
            };
        } else {
            if (!containerUri) {
                throw new context.CancelError('Container Image URI is required in Container artifact mode!');
            }
            agentRuntimeArtifact = {
                containerConfiguration: { containerUri }
            };
        }

        const { controlClient } = lib.init(context);

        const params = {
            agentRuntimeName,
            agentRuntimeArtifact,
            roleArn,
            networkConfiguration: { networkMode: networkMode || 'PUBLIC' }
        };
        if (serverProtocol) {
            params.protocolConfiguration = { serverProtocol };
        }
        if (description) {
            params.description = description;
        }
        if (environmentVariables) {
            if (typeof environmentVariables === 'string') {
                try {
                    params.environmentVariables = JSON.parse(environmentVariables);
                } catch (e) {
                    throw new context.CancelError('Invalid JSON in Environment Variables: ' + e.message);
                }
            } else {
                params.environmentVariables = environmentVariables;
            }
        }

        const response = await controlClient.send(new CreateAgentRuntimeCommand(params));

        return context.sendJson({
            agentRuntimeId: response.agentRuntimeId,
            agentRuntimeArn: response.agentRuntimeArn,
            agentRuntimeVersion: response.agentRuntimeVersion,
            status: response.status,
            createdAt: response.createdAt
        }, 'out');
    }
};
