'use strict';

const AutoDetectDecoderStream = require('autodetect-decoder-stream');
const CsvReadableStream = require('csv-reader');
const { pipeline, Transform } = require('stream');
// See https://getdtl.org/#TryDTL to experiment with DTL transformations.
const DTL = require('dtl-js');

module.exports = {

    async receive(context) {

        let { fileId, filename, transformation } = context.messages.in.content;

        context.log({ step: 'CSV processing started', fileId, filename, transformation });

        const csvStream = await getCSVStream(context, fileId);
        let dtl = new DTL();

        // Create a writable stream to process the CSV data
        const writableStream = pipeline(
            csvStream,
            new Transform({
                objectMode: true,
                transform: (row, encoding, callback) => {

                    // --- Your own processing logic is in `transformation` object ---
                    // console.log('Processing row:', row);
                    // Apply DTL transformation

                    let result = dtl.apply(row, transformation);
                    // console.log('DTL result:', result);

                    // --- End of your own processing logic ---
                    callback(null, result); // Pass the processed row(s) to the next stream
                }
            }),
            (err) => {
                if (err) throw err; // Propagate the error
                context.log({ step: 'CSV processing completed', filename });
            }
        );

        // Save the processed CSV stream to a file in Appmixer's GridFS
        const savedFile = await context.saveFileStream(filename, writableStream);

        // Output the result so that connected components can use it.
        return context.sendJson({ fileId: savedFile.fileId, filename }, 'out');
    }
};

/**
 * Get a CSV stream from a file in Appmixer's GridFS.
 * This stream is split by rows and processed in chunks to handle large CSV files.
 * @return {Promise<Stream>}
 */
async function getCSVStream(context, fileId) {

    // GridFSBucketReadStream from Appmixer
    const readStream = await context.getFileReadStream(fileId);

    /** How to split the default GridFSBucketReadStream chunk size of 255 KB into smaller chunks.
     *  This is to avoid the "Maximum call stack size exceeded" error when reading large CSV files.
     */
    const SAFE_CSV_STREAM_CHUNK_SIZE = 1024;

    // TODO: Let the user configure the CSV stream options.
    const csvStreamOptions = {
        delimiter: ',',
        parseNumbers: true,
        parseBooleans: true,
        trim: true
    };

    // Transform stream to emit data in chunks of SAFE_CSV_STREAM_CHUNK_SIZE
    class ChunkedStream extends Transform {
        constructor(chunkSize = SAFE_CSV_STREAM_CHUNK_SIZE) {
            super();
            this.chunkSize = chunkSize;
            this.buffer = Buffer.alloc(0);
        }
        _transform(chunk, encoding, callback) {
            this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
            while (this.buffer.length >= this.chunkSize) {
                this.push(this.buffer.slice(0, this.chunkSize));
                this.buffer = this.buffer.slice(this.chunkSize);
            }
            callback();
        }
        _flush(callback) {
            if (this.buffer.length > 0) {
                this.push(this.buffer);
            }
            callback();
        }
    }
    const chunkedStream = new ChunkedStream(SAFE_CSV_STREAM_CHUNK_SIZE);
    const autoDetectDecoderStream = new AutoDetectDecoderStream();
    const csvReadableStream = new CsvReadableStream(csvStreamOptions);

    return pipeline(
        readStream, // Read stream from Appmixer's GridFS
        chunkedStream, // Chunked stream to split data into smaller chunks managable by `CsvReadableStream`
        autoDetectDecoderStream, // Auto-detect encoding
        csvReadableStream, // CSV reader stream
        (err) => {
            // console.error('Pipeline', err ? 'failed' : 'succeeded', err);
        }
    );
}
