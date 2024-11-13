const crypto = require('crypto');
const { parse } = require('csv-parse');
const workerpool = require('workerpool');

const pool = workerpool.pool(__dirname + '/prepareMembers.js');

module.exports = {

    async sendCSVAudienceToFacebook(context, method, operation) {

        const BATCH_SIZE = parseInt(context.config.batchSize) || 10000;
        const TIMEOUT_TRIGGER_SECONDS = parseInt(context.config.timeoutTriggerSeconds) || (60 * 10);
        const TIMEOUT_SECONDS = parseInt(context.config.timeoutSeconds) || 60;

        let accountId;
        let audienceId;
        let fileId;
        let schema;
        let sessionId;
        let rowsProcessed;
        let numInvalidEntries;
        let invalidEntrySamples;
        let timeStart;
        let batchIndex;

        if (context.messages.timeout) {
            const msg = context.messages.timeout.content;
            accountId = msg.accountId;
            audienceId = msg.audienceId;
            fileId = msg.fileId;
            schema = msg.schema;
            // Next are values that allows us to resume the upload process.
            sessionId = msg.sessionId;
            rowsProcessed = msg.rowsProcessed;
            numInvalidEntries = msg.numInvalidEntries;
            invalidEntrySamples = msg.invalidEntrySamples;
            timeStart = msg.timeStart;
            batchIndex = msg.batchIndex;
        } else {
            const msg = context.messages.in.content;
            accountId = msg.accountId;
            audienceId = msg.audienceId;
            fileId = msg.fileId;
            schema = msg.schema;
            // Initialize the upload process.
            // randomInt limit is (max - min) < 2^48. See https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback.
            sessionId = crypto.randomInt(0, 2 ** 48 - 1);
            rowsProcessed = 0;
            numInvalidEntries = 0;
            invalidEntrySamples = [];
            timeStart = new Date;
            batchIndex = 0;
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
            columns: header => header.map(column => column.toLowerCase().trim())
        }));

        let batch = [];
        let estimatedMembersCount = 0;

        // Process rows in a way so that we can detect the last row (and therefore last batch).
        let previousRow = null;

        let skipRows = rowsProcessed;

        const receiveTimeStart = new Date;

        try {
            for await (const row of reader) {

                // This is a continuation of the upload process. We need to skip
                // the rows that have already been processed.
                if (skipRows > 0) {
                    skipRows -= 1;
                    continue;
                }

                const timeElapsed = (new Date - timeStart) / 1000;
                const receiveTimeElapsed = (new Date - receiveTimeStart) / 1000;
                if (receiveTimeElapsed > TIMEOUT_TRIGGER_SECONDS) {
                    // If the process has been running for long, we need to stop and resume later.
                    reader.destroy();
                    await context.log({
                        step: 'timeout',
                        timeStart,
                        receiveTimeStart,
                        timeElapsedSeconds: timeElapsed,
                        recieveTimeElapsedSeconds: receiveTimeElapsed,
                        rowsProcessed,
                        sessionId,
                        numInvalidEntries
                    });
                    return context.setTimeout({
                        accountId,
                        audienceId,
                        fileId,
                        schema,
                        sessionId,
                        rowsProcessed,
                        batchIndex,
                        numInvalidEntries,
                        invalidEntrySamples,
                        timeStart: (new Date(timeStart)).getTime()
                    }, TIMEOUT_SECONDS * 1000);
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

                        const response = await sendBatchToFacebook(
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
                        numInvalidEntries += response.data.num_invalid_entries;
                        await context.log({
                            step: 'batch-response',
                            data: response.data,
                            headers: response.headers,
                            totalNumInvalidEntries: numInvalidEntries
                        });
                        const invalid = response.data.invalid_entry_samples;
                        if (invalid && Object.keys(invalid).length) {
                            invalidEntrySamples = invalidEntrySamples.concat(invalid);
                        }
                        batchIndex += 1;
                        batch = []; // Clear the batch.
                    }

                    rowsProcessed += 1;
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
            const response = await sendBatchToFacebook(
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
            numInvalidEntries += response.data.num_invalid_entries;
            await context.log({
                step: 'batch-response',
                data: response.data,
                headers: response.headers,
                totalNumInvalidEntries: numInvalidEntries
            });
            invalidEntrySamples = invalidEntrySamples.concat(response.data.invalid_entry_samples || []);
            rowsProcessed += 1;
        }

        return context.sendJson({
            account_id: accountId,
            audience_id: audienceId,
            num_invalid_entries: numInvalidEntries,
            invalid_entry_samples: invalidEntrySamples,
            num_total_entries: rowsProcessed
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
        timeElapsed: (new Date - timeStart) / 1000
    });

    let response;

    try {
        // Send 3 times so that we can gracefully recover from very short HTTP request glitches
        // and don't need to repeat the entire upload from the start.
        response = await sendRequestWithRetry(context, method, url, body);
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
    return response;
}

async function sendRequestWithRetry(context, method, url, body, maxRetries = 3) {

    let retries = 0;
    let lastError;
    while (retries < maxRetries) {
        try {
            const response = await (method === 'delete' ?
                context.httpRequest.delete(url, { data: body }) : context.httpRequest[method](url, body));
            return response;
        } catch (error) {
            lastError = error;
            retries += 1;
            await context.log({
                step: 'batch-retry',
                url,
                retries,
                error: error.message,
                data: error.response.data,
                headers: error.response.headers,
                status: error.response.status
            });
        }
    }
    throw lastError;
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
