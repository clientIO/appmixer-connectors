const { randomInt, createHash } = require('crypto');
const csv = require('csv-parser');

const BATCH_SIZE = 10000;
// See https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences#replace-api.
const REPLACE_SESSION_DURATION_WINDOW = 1000 * 60 * 88; // 88 minutes to stay on the safe side.

module.exports = {

    async receive(context) {

        const { accountId, audienceId, fileId, schema } = context.messages.in.content;

        const schemaConfig = {};

        if (schema) {
            schema.ADD.forEach(item => {
                schemaConfig[item.csvHeader.toLowerCase().trim()] = item.fbType;
            });
        }

        const fileStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);

        const reader = fileStream.pipe(csv({
            mapHeaders: ({ header }) => header.toLowerCase().trim()
        }));

        // randomInt limit is (max - min) < 2^48. See https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback.
        let sessionId = randomInt(0, 2**48 - 1);
        let batch = [];
        let batchIndex = 0;
        let estimatedMembersCount = 0;
        let membersCount = 0;
        let operation = 'usersreplace';
        let isLastBatch = false;

        let numInvalidEntries = 0;
        let invalidEntrySamples = [];

        const replaceStartedAt = new Date();

        // Process rows in a way so that we can detect the last row (and therefore last batch).
        let previousRow = null;

        for await (const row of reader) {
            membersCount += 1;
            isLastBatch = false;

            const timeElapsed = new Date() - replaceStartedAt;
            const isReplaceSessionExpiring = timeElapsed > REPLACE_SESSION_DURATION_WINDOW;

            if (operation === 'usersreplace' && isReplaceSessionExpiring) {
                // The maximum duration window for 1 replace session is 90 minutes. (We use 88 minutes to stay on the safe side.)
                // The API will reject any batches for a session received after 90 minutes from the time the session started.
                // If you need to send batches for a duration longer than 90 minutes,
                // wait until the replace operation for that session is done,
                // then use the /<CUSTOM_AUDIENCE>/users endpoint’s add operation for the rest of your uploads.
                // See https://developers.facebook.com/docs/marketing-api/audiences/guides/custom-audiences#replace-api.
                isLastBatch = true; // The very next batch will be the last batch in the replace session.
                await context.log({
                    step: 'replace-session-expiring',
                    message: 'Replace session expiring. Uploading last batch and switching to add operation.',
                    timeElapsedMs: timeElapsed
                });
            }

            if (previousRow !== null) {
                batch.push(previousRow);
                if (batch.length >= BATCH_SIZE) {

                    if (batchIndex === 0) {
                        // First batch. Estimate the total number of members.
                        estimatedMembersCount = estimateNumberOfRows(fileInfo.length, batch);
                    }

                    const response = await sendBatchToFacebook(
                        context,
                        audienceId,
                        schemaConfig,
                        sessionId,
                        batch,
                        batchIndex,
                        isLastBatch,
                        estimatedMembersCount,
                        operation
                    );
                    await context.log({ step: 'batch-response', data: response.data, headers: response.headers });
                    numInvalidEntries += response.data.num_invalid_entries;
                    invalidEntrySamples = invalidEntrySamples.concat(response.data.invalid_entry_samples || []);
                    batchIndex += 1;
                    batch = []; // Clear the batch

                    if (operation === 'usersreplace' && isReplaceSessionExpiring) {
                        // Reset session, switch to POST /users.
                        sessionId = randomInt(0, 2**48 - 1);
                        batchIndex = 0;
                        operation = 'users';
                    }
                }
            }
            previousRow = row;
        }

        if (previousRow !== null) {
            batch.push(previousRow);
            if (!estimatedMembersCount) {
                estimatedMembersCount = estimateNumberOfRows(fileInfo.length, batch);
            }
            isLastBatch = true;
            // Now process the last batch after loop ends.
            const response = await sendBatchToFacebook(
                context,
                audienceId,
                schemaConfig,
                sessionId,
                batch,
                batchIndex,
                isLastBatch,
                estimatedMembersCount,
                operation
            );
            await context.log({ step: 'batch-response', data: response.data, headers: response.headers });
            numInvalidEntries += response.data.num_invalid_entries;
            invalidEntrySamples = invalidEntrySamples.concat(response.data.invalid_entry_samples || []);
        }

        return context.sendJson({
            account_id: accountId,
            audience_id: audienceId,
            num_invalid_entries: numInvalidEntries,
            invalid_entry_samples: invalidEntrySamples,
            num_total_entries: membersCount
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
    // This is a very rough estimate and may not be accurate.
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

async function sendBatchToFacebook(context, audienceId, schemaConfig, sessionId, batch, batchIndex, isLastBatch, estimatedMembersCount, operation) {

    const body = {
        payload: {
            schema: detectSchema(batch, schemaConfig),
            data: prepareMembers(batch, schemaConfig)
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

    await context.log({ step: 'batch', schema: body.payload.schema, session: body.session, size: batch.length, operation });

    let response;;

    try {
        response = await context.httpRequest.post(url, body);
    } catch (error) {
        await context.log({
            step: 'batch-error',
            error: error.message,
            data: error.response.data,
            headers: error.response.headers,
            status: error.response.status
        });
        throw error;
    }
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

function prepareMembers(batch, schemaConfig) {

    return batch.map(member => {
        const memberData = [];
        for (const column in member) {
            if (schemaConfig[column]) {
                const value = createHash('sha256').update(member[column]).digest('hex');
                memberData.push(value);
            }
        }
        return memberData;
    });
}
