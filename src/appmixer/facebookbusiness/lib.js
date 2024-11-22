const crypto = require('crypto');
const { parse } = require('csv-parse');
const workerpool = require('workerpool');

const pool = workerpool.pool(__dirname + '/prepareMembers.js');

module.exports = {

    async sendCSVAudienceToFacebook(context, method, operation) {

        // Max number of members to upload to Facebook in a single batch.
        const BATCH_SIZE = parseInt(context.config.batchSize) || 10000;
        // Time after which we jump out of the current receive function by scheduling a timeout to continue
        // uploading in a later receive function call. This must be lower than 23 minutes which is
        // maximum time Appmixer engine can run the receive() method before it assumes it's
        // not successful and re-runs it again.
        const TIMEOUT_TRIGGER_SECONDS = parseInt(context.config.timeoutTriggerSeconds) || (60 * 5);
        // Time before the next receive() is run after the previous one was jumped out of with timeout.
        // We set 1 minute by default which is the minimum we can set for a timeout in Appmixer anyway.
        const TIMEOUT_SECONDS = parseInt(context.config.timeoutSeconds) || 60;
        // The maximum time we attempt the upload.
        const MAX_CONTINUATION_PERIOD_SECONDS = parseInt(context.config.maxContinuationPeriodSeconds) || (60 * 60 * 12);
        // The maximum duration window for 1 replace session is 90 minutes.
        // The API will reject any batches for a session received after 90 minutes from the time the session started.
        // If you need to send batches for a duration longer than 90 minutes,
        // wait until the replace operation for that session is done, then use the users endpoint.
        // See https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences/#replace-api.
        const MAX_USERSREPLACE_PERIOD_SECONDS = 60 * 90;

        let accountId;
        let audienceId;
        let fileId;
        let delimiter;
        let schema;
        let sessionId;
        let numInvalidEntries;
        let invalidEntrySamples;
        let timeStart;
        let batchIndex;
        let estimatedMembersCount;
        let processedRows;

        if (context.messages.timeout) {
            const msg = context.messages.timeout.content;
            accountId = msg.accountId;
            audienceId = msg.audienceId;
            fileId = msg.fileId;
            delimiter = msg.delimiter;
            schema = msg.schema;
            // Next are values that allows us to resume the upload process.
            sessionId = msg.sessionId;
            numInvalidEntries = msg.numInvalidEntries;
            invalidEntrySamples = msg.invalidEntrySamples;
            timeStart = msg.timeStart;
            batchIndex = msg.batchIndex;
            estimatedMembersCount = msg.estimatedMembersCount;
            processedRows = msg.processedRows;
            operation = msg.operation;
        } else {
            const msg = context.messages.in.content;
            accountId = msg.accountId;
            audienceId = msg.audienceId;
            fileId = msg.fileId;
            delimiter = msg.delimiter;
            schema = msg.schema;
            // Initialize the upload process.
            // randomInt limit is (max - min) < 2^48. See https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback.
            sessionId = crypto.randomInt(0, 2 ** 48 - 1);
            numInvalidEntries = 0;
            invalidEntrySamples = [];
            timeStart = new Date;
            batchIndex = 0;
            processedRows = 0;
        }

        if ((new Date - timeStart) >= (MAX_CONTINUATION_PERIOD_SECONDS * 1000)) {
            throw new context.CancelError('Error uploading audience. Max upload time reached. Check your audience and retry manually later.');
        }

        const schemaConfig = {};
        if (schema) {
            schema.ADD.forEach(item => {
                schemaConfig[item.csvHeader.toLowerCase().trim()] = item.fbType;
            });
        }

        const fileStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);

        const reader = fileStream.pipe(parse({
            columns: header => header.map(column => column.toLowerCase().trim()),
            delimiter: delimiter || ','
        }));

        let batch = [];
        // Process rows in a way so that we can detect the last row (and therefore last batch).
        let previousRow = null;
        let skipRows = processedRows;
        const receiveTimeStart = new Date;

        const scheduleContinuation = async function(reason, error) {

            await context.log({
                step: 'continuation',
                reason,
                error,
                timeStart,
                receiveTimeStart,
                timeElapsedSeconds: (new Date - timeStart) / 1000,
                recieveTimeElapsedSeconds: (new Date - receiveTimeStart) / 1000,
                sessionId,
                numInvalidEntries,
                processedRows,
                batchIndex
            });
            reader.destroy();
            return context.setTimeout({
                accountId,
                audienceId,
                fileId,
                delimiter,
                schema,
                sessionId,
                batchIndex,
                numInvalidEntries,
                invalidEntrySamples,
                timeStart: (new Date(timeStart)).getTime(),
                estimatedMembersCount,
                operation,
                processedRows
            }, TIMEOUT_SECONDS * 1000);
        };

        if (operation === 'usersreplace' && (new Date - timeStart) >= (MAX_USERSREPLACE_PERIOD_SECONDS * 1000)) {
            // Restart the upload process with the users endpoint. Continue from the last processed batch, however.
            operation = 'users';
            sessionId = crypto.randomInt(0, 2 ** 48 - 1);
            batchIndex = 0;
            estimatedMembersCount -= processedRows;
            numInvalidEntries = 0;
            invalidEntrySamples = [];
            timeStart = new Date;
        }
        try {
            for await (const row of reader) {

                // This is a continuation of the upload process. We need to skip
                // the rows that have already been processed.
                if (skipRows > 0) {
                    skipRows -= 1;
                    continue;
                }

                if ((new Date - receiveTimeStart) >= TIMEOUT_TRIGGER_SECONDS * 1000) {
                    // If the process has been running for long, we need to stop and resume later.
                    return scheduleContinuation('timeout');
                }

                // This is a trick to process the first row "later", at the time we've read the second row.
                // This allows us to see if we've reached the end and can set the last_batch_flag below,
                // when processing the very last row.
                if (previousRow !== null) {
                    batch.push(previousRow);
                    if (batch.length >= BATCH_SIZE) {

                        if (!estimatedMembersCount) {
                            // First batch. Estimate the total number of members.
                            estimatedMembersCount = estimateNumberOfRows(fileInfo.length, batch);
                        }

                        let response;
                        try {
                            response = await sendBatchToFacebook(
                                context,
                                method,
                                operation,
                                audienceId,
                                schemaConfig,
                                sessionId,
                                batch,
                                batchIndex,
                                false,  // last_batch_flag
                                estimatedMembersCount,
                                timeStart
                            );
                        } catch (err) {
                            const fbError = err.response?.data?.error;
                            return scheduleContinuation('retry', fbError);
                        }
                        numInvalidEntries += response.data.num_invalid_entries;
                        const invalid = response.data.invalid_entry_samples;
                        if (invalid && Object.keys(invalid).length) {
                            invalidEntrySamples = invalidEntrySamples.concat(invalid);
                        }
                        batchIndex += 1;
                        processedRows += batch.length;
                        batch = []; // Clear the batch.
                    }
                }
                previousRow = row;
            }
        } finally {
            reader.destroy();
        }

        if (previousRow !== null) {
            batch.push(previousRow);
            if (!estimatedMembersCount) {
                estimatedMembersCount = estimateNumberOfRows(fileInfo.length, batch);
            }
            // Now process the last batch after loop ends.
            let response;
            try {
                response = await sendBatchToFacebook(
                    context,
                    method,
                    operation,
                    audienceId,
                    schemaConfig,
                    sessionId,
                    batch,
                    batchIndex,
                    true, // last_batch_flag
                    estimatedMembersCount,
                    timeStart
                );
            } catch (err) {
                const fbError = err.response?.data?.error;
                return scheduleContinuation('retry', fbError);
            }
            numInvalidEntries += response.data.num_invalid_entries;
            invalidEntrySamples = invalidEntrySamples.concat(response.data.invalid_entry_samples || []);
            processedRows += batch.length;
        }

        return context.sendJson({
            account_id: accountId,
            audience_id: audienceId,
            num_invalid_entries: numInvalidEntries,
            invalid_entry_samples: invalidEntrySamples,
            num_total_entries: processedRows
        }, 'out');
    }
};

function getRandomUniqueElements(array, numElements) {

    if (numElements >= array.length) {
        return array;
    }
    const selectedIndices = new Set();
    const result = [];

    while (result.length < numElements) {
        const index = Math.floor(Math.random() * array.length);
        if (!selectedIndices.has(index)) {
            selectedIndices.add(index);
            result.push(array[index]);
        }
    }
    return result;
}

function estimateNumberOfRows(fileSize, batch) {

    // Estimate the number of rows in the file.
    // This is a very rough estimate and may not be accurate but sufficient for Facebook API.
    // We don't want to loop over the entire batch rows. Instead,
    // we will randomly select a limited number of rows and calculate
    // the avarage row size in Bytes, then divide the total file size by this number.
    const randomRows = getRandomUniqueElements(batch, 20);
    let randomRowsSize = 0;
    for (const row of randomRows) {
        randomRowsSize += Buffer.from(Object.values(row).join('')).length;
    }
    const averageRowSize = randomRowsSize / randomRows.length;
    return Math.floor(fileSize / averageRowSize) + 1;
}

async function sendBatchToFacebook(
    context,
    method,
    operation,
    audienceId,
    schemaConfig,
    sessionId,
    batch,
    batchIndex,
    isLastBatch,
    estimatedMembersCount,
    timeStart) {

    // Execute in a thread to avoid blocking the event loop of the engine.
    const members = await pool.exec('prepareMembers', [batch, schemaConfig]);

    const body = {
        payload: {
            schema: detectSchema(batch, schemaConfig),
            data: members
        },
        session: {
            session_id: sessionId,
            batch_seq: batchIndex + 1,
            last_batch_flag: isLastBatch,
            estimated_num_total: estimatedMembersCount
        },
        access_token: context.auth.accessToken
    };

    const url = `https://graph.facebook.com/v20.0/${audienceId}/${operation}`;

    await context.log({
        step: 'batch',
        schema: body.payload.schema,
        session: body.session,
        size: batch.length,
        gridInstanceId: context.gridInstanceId,
        timeElapsedSeconds: (new Date - timeStart) / 1000,
        url
    });

    let response;

    try {
        // Send 3 times so that we can gracefully recover from very short HTTP request glitches
        // and don't need to repeat the entire upload from the start.
        response = await (method === 'delete' ?
            context.httpRequest.delete(url, { data: body }) : context.httpRequest[method](url, body));
    } catch (error) {
        await context.log({
            step: 'batch-error',
            url,
            error: error.message,
            data: error.response.data,
            headers: error.response.headers,
            status: error.response.status
        });
        throw error;
    }
    await context.log({
        step: 'batch-response',
        data: response.data,
        headers: response.headers
    });
    return response;
}

function detectSchema(batch, schemaConfig) {

    let schema = [];
    for (const csvHeader in batch[0]) {
        if (schemaConfig[csvHeader]) {
            schema.push(schemaConfig[csvHeader]);
        }
    }
    return schema;
}
