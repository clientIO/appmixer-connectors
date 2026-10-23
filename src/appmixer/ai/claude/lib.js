const { Transform } = require('stream');

module.exports = {

    /**
     * Adds the numeric token counts of `usage` to `total` (used when a single component
     * run makes multiple Messages API calls, e.g. the AI Agent tool loop).
     * Non-numeric fields are taken from the latest response.
     * @param {Object} total - Accumulated usage (or undefined).
     * @param {Object} usage - Usage object from the latest API response.
     * @returns {Object} Accumulated usage.
     */
    addUsage: function(total, usage) {

        if (!usage) return total;
        if (!total) return { ...usage };

        const result = { ...total };
        Object.keys(usage).forEach((key) => {
            if (typeof usage[key] === 'number') {
                result[key] = (typeof total[key] === 'number' ? total[key] : 0) + usage[key];
            } else {
                result[key] = usage[key];
            }
        });
        return result;
    },

    /**
    * Splits a readable stream into chunks of n bytes.
    * @param {Readable} inputStream - The readable stream to split.
    * @param {number} chunkSize - Size of each chunk in bytes.
    * @returns {Readable} - A readable stream emitting chunks.
    */
    splitStream: function(inputStream, chunkSize) {

        let leftover = Buffer.alloc(0);

        const transformStream = new Transform({
            transform(chunk, encoding, callback) {
                // Combine leftover buffer with the new chunk
                const combined = Buffer.concat([leftover, chunk]);
                const combinedLength = combined.length;

                // Emit chunks of the desired size
                let offset = 0;
                while (offset + chunkSize <= combinedLength) {
                    this.push(combined.subarray(offset, offset + chunkSize));
                    offset += chunkSize;
                }

                // Store leftover data
                leftover = combined.subarray(offset);

                callback();
            },
            flush(callback) {
                // Push any remaining data as the final chunk
                if (leftover.length > 0) {
                    this.push(leftover);
                }
                callback();
            }
        });

        return inputStream.pipe(transformStream);
    }

};
