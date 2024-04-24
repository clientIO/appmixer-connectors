'use strict';
const AutoDetectDecoderStream = require('autodetect-decoder-stream');
const CsvReadableStream = require('csv-reader');
const stream = require('stream');
const { PassThrough, pipeline } = stream;
const { passesFilter, indexExpressionToArray, passesIndexFilter, expressionTransformer } = require('./helpers');

module.exports = class CSVProcessor {

    static async getHeadersAsObject(processor) {

        await processor.loadHeaders();
        const headers = processor.getHeaders();
        return headers.reduce((acc, header) => {
            acc[header] = header;
            return acc;
        }, {});
    }

    constructor(context, fileId, options = {}) {

        this.context = context;
        this.fileId = fileId;
        this.withHeaders = typeof options.withHeaders === 'boolean' ? options.withHeaders : true;
        this.header = null;
        this.delimiter = options.delimiter || ',';
        this.parseNumbers = typeof options.parseNumbers === 'boolean' ? options.parseNumbers : true;
        this.parseBooleans = typeof options.parseBooleans === 'boolean' ? options.parseBooleans : true;
    }

    /**
     * Get CSV headers.
     * @return {[]}
     * @public
     */
    getHeaders() {

        if (!this.withHeaders) {
            throw new Error('The CSVProcessor instance was declared to have no column headers.');
        }
        if (this.header) {
            return this.header;
        } else {
            throw new Error('Headers have not been loaded.');
        }
    }

    /**
     * @param header
     * @return {*}
     * @public
     */
    getHeaderIndex(header) {

        return this.getHeaderIndexes([header])[0];
    }

    /**
     * @param headers
     * @return {[]}
     * @public
     */
    getHeaderIndexes(headers) {

        const csvHeaders = this.getHeaders();
        const indexes = [];
        headers.forEach(header => {
            const idx = csvHeaders.findIndex(h => h === header);
            if (idx === -1) {
                throw new Error(`The ${header} header was not found`);
            }
            indexes.push(idx);
        });
        return indexes;
    }

    /**
     * @param row
     * @return {{}}
     * @public
     */
    mapRow(row) {

        const headers = this.getHeaders();
        const mappedRow = {};
        for (const header of headers) {
            const idx = this.getHeaderIndex(header);
            mappedRow[header] = row[idx];
        }
        return mappedRow;
    }

    /**
     * Add column.
     * @param {Object} options
     * @param {string} options.positioningMethod
     * @param {string} options.positioningColumn
     * @param {number} options.index
     * @param {string} options.name
     * @param {string} options.defaultValue
     * @returns {Promise<unknown>}
     */
    async addColumn(options) {

        let idx;
        const positioningMethod = options.positioningMethod || 'afterColumn';
        if (positioningMethod !== 'index' && this.withHeaders && options.positioningColumn) {
            await this.loadHeaders();
            const headerIdx = this.getHeaderIndex(options.positioningColumn);
            idx = positioningMethod === 'beforeColumn' ? headerIdx : headerIdx + 1;
        } else if (options.index) {
            idx = options.index;
        } else {
            throw new Error('No position specified for the new column');
        }

        if (!options.name && this.withHeaders) {
            throw new Error('No name specified for the new column');
        }

        const name = options.name || '';
        const defaultValue = options.defaultValue || '';

        return this.editCSV((i, row) => {
            let val = i === 0 && this.withHeaders ? name : defaultValue;
            row.splice(idx, 0, val);
            return row;
        });
    }

    /**
     * @param oldName
     * @param newName
     * @return {Promise<*>}
     * @public
     */
    async renameColumn(oldName, newName) {

        await this.loadHeaders();
        const idx = this.getHeaderIndex(oldName);

        return this.editCSV((i, row) => {
            if (i === 0) {
                row[idx] = newName;
            }
            return row;
        });
    }

    /**
     * @param options
     * @return {Promise<*>}
     * @public
     */
    async deleteColumns(options) {

        let indexes;

        if (this.withHeaders) {
            await this.loadHeaders();
            const columns = options.columns ? options.columns.split(',') : [];
            indexes = this.getHeaderIndexes(columns);
        } else {
            const inputIndexes = options.indexes || '';
            indexes = indexExpressionToArray(inputIndexes);
        }

        return this.editCSV((idx, row) => {
            const newRow = [];
            for (let i = 0; i < row.length; i++) {
                if (!indexes.includes(i)) {
                    newRow.push(row[i]);
                }
            }
            return newRow;
        });
    }

    /**
     * Update rows.
     * @param {Object} options
     * @returns {Promise<void>}
     */
    async updateRows(options) {

        const filter = options.filter || [];
        const values = options.values || {};
        const indexes = options.indexes || '';
        const indexedValues = options.indexedValues || [];

        await this.loadHeaders();

        return this.editCSV((idx, row) => {

            if (this.withHeaders) {
                const mappedRow = this.mapRow(row);
                if (passesFilter(mappedRow, filter)) {
                    return this.mappedRowToArray({ ...mappedRow, ...values });
                } else {
                    return row;
                }
            } else {
                if (passesIndexFilter(idx, indexes)) {
                    const values = Array.isArray(indexedValues) ? indexedValues : [indexedValues];
                    values.forEach(val => {
                        Object.entries(val).forEach(([key, value]) => {
                            row[key] = value;
                        });
                    });
                    return row;
                } else {
                    return row;
                }
            }
        });
    }

    /**
     * @param options
     * @return {Promise<*>}
     * @public
     */
    async deleteRows(options) {

        const filter = options.filters || [];
        const indexExpression = options.indexExpression || '';

        await this.loadHeaders();

        return this.editCSV((idx, row) => {
            if (this.withHeaders) {
                const mappedRow = this.mapRow(row);
                if (passesFilter(mappedRow, filter) && idx > 0) {
                    return null;
                } else {
                    return row;
                }
            } else {
                if (passesIndexFilter(idx, indexExpression)) {
                    return null;
                } else {
                    return row;
                }
            }
        });
    }

    /**
     * @param options
     * @return {Promise<*>}
     * @public
     */
    async getRows(options) {

        const getAllRows = options.getAllRows;
        const filters = options.filters || [];
        const indexExpression = options.indexExpression || '';
        const stopOnFirstMatch = options.stopOnFirstMatch || false;

        const lock = await this.context.lock(this.fileId);
        await this.loadHeaders();
        const readStream = await this.loadFile();

        return new Promise((resolve, reject) => {
            const rows = [];
            let idx = 0;

            readStream.on('data', row => {
                try {
                    if (getAllRows) {
                        if ((this.withHeaders && idx > 0) || !this.withHeaders) {
                            rows.push(row);
                        }
                    } else if (this.withHeaders) {
                        const mappedRow = this.mapRow(row);
                        if (idx > 0 && passesFilter(mappedRow, filters)) {
                            rows.push(row);
                            if (stopOnFirstMatch) {
                                readStream.destroy();
                            }
                        }
                    } else {
                        if (passesIndexFilter(idx, indexExpression)) {
                            rows.push(row);
                            if (stopOnFirstMatch) {
                                readStream.destroy();
                            }
                        }
                    }
                    idx += 1;
                } catch (err) {
                    readStream.destroy(err);
                }
            }).on('error', err => {
                lock.unlock();
                reject(err);
            }).on('close', () => {
                lock.unlock();
                resolve(rows);
            }).on('end', () => {
                lock.unlock();
                resolve(rows);
            });
        });
    }

    /**
     * @param closure
     * @return {Promise<*>}
     * @public
     */
    async editCSV(closure) {

        const lock = await this.context.lock(this.fileId);
        try {
            const stream = await this.loadFile();
            let index = 0;
            const writeStream = new PassThrough();

            const replacePromise = new Promise((resolve, reject) => {
                let rejected = false;
                writeStream.on(('error'), (err) => {
                    if (!rejected) {
                        rejected = true;
                        reject(err);
                    }
                });
                this.context.replaceFileStream(this.fileId, writeStream).then(result => {
                    resolve(result);
                }).catch(err => {
                    if (!rejected) {
                        rejected = true;
                        reject(err);
                    }
                });
            });

            stream.on('data', (row) => {
                try {
                    const newRow = closure(index, row);
                    if (newRow) {
                        writeStream.write(newRow.join(this.delimiter) + '\n');
                    }
                    index = index + 1;
                } catch (err) {
                    writeStream.destroy(err);
                }
            }).on('close', (err) => {
                if (err) {
                    writeStream.destroy(err);
                }
            }).on('error', (err) => {
                writeStream.destroy(err);
            }).on('end', async () => {
                writeStream.end();
            });

            return await replacePromise;
        } finally {
            lock.unlock();
        }
    }

    /**
     * @param newRow
     * @param closure
     * @return {Promise<*>}
     * @public
     */
    async addRow({ row, rowWithColumns }, closure) {

        const config = this.context.config;
        const lockOptions = {
            ttl: parseInt(config.lockTTL, 10) || 60000, // Default 1 minute TTL
            retryDelay: 500
        };
        const lock = await this.context.lock(this.fileId, lockOptions);
        let lockExtendInterval;

        try {
            lockExtendInterval = setInterval(async () => {

                await lock.extend(parseInt(context.config.lockExtendTime, 10) || 1000 * 60 * 1);
            }, context.config.lockExtendInterval || 30000);

            const stream = await this.loadFile();
            await this.loadHeaders();

            let rowAsArray;

            // Process row data based on whether headers are included
            if (this.withHeaders) {
                const headers = this.getHeaders();
                const parsed = expressionTransformer(rowWithColumns);
                rowAsArray = headers.map(() => ''); // Initialize rowAsArray with empty strings
                parsed.forEach(({ column, value }) => {
                    const idx = this.getHeaderIndex(column);
                    if (idx !== -1) { // Ensure the column exists in headers
                        rowAsArray[idx] = value;
                    }
                });
            } else {
                rowAsArray = row.split(this.delimiter);
            }

            // Ensure each item in rowAsArray is not undefined or null
            rowAsArray = rowAsArray.map(item => item ?? '');

            let idx = 0;
            const writeStream = new PassThrough();

            stream.on('data', (rowData) => {
                writeStream.write(rowData.join(this.delimiter) + '\n');
                if (closure(idx, rowData, false)) {
                    writeStream.write(rowAsArray.join(this.delimiter) + '\n');
                }
                idx++;
            });

            stream.on('error', (err) => {
                lock.unlock();
                writeStream.end();
                throw err; // Propagate the error
            });

            stream.on('end', () => {
                if (closure(idx, null, true)) {
                    writeStream.write(rowAsArray.join(this.delimiter) + '\n');
                }
                writeStream.end();
            });

            // Replace file stream with writeStream
            return await this.context.replaceFileStream(this.fileId, writeStream);
        } catch (err) {
            throw err; // Propagate the error
        } finally {
            clearInterval(lockExtendInterval);
            lock.unlock();
        }
    }


    /**
     * @return {Promise<Stream>}
     * @protected
     */
    async loadFile() {

        const readStream = await this.context.getFileReadStream(this.fileId);

        const autoDetectDecoderStream = new AutoDetectDecoderStream();
        const csvReadableStream = new CsvReadableStream({
            delimiter: this.delimiter,
            parseNumbers: this.parseNumbers,
            parseBooleans: this.parseBooleans,
            trim: true
        });

        return pipeline(
            readStream,
            autoDetectDecoderStream,
            csvReadableStream,
            (err) => {
            }
        );
    }

    /**
     * @return {Promise<*>}
     * @public
     */
    async loadHeaders() {

        const stream = await this.loadFile();

        return new Promise((resolve, reject) => {
            let header;
            stream.on('data', (data) => {
                header = data;
                stream.destroy();
            }).on('error', (err) => {
                reject(err);
            }).on('close', () => {
                this.header = header;
                resolve(header);
            });
        });
    }

    /**
     * @param mappedRow
     * @return {[]}
     * @protected
     */
    mappedRowToArray(mappedRow) {

        const rowArray = [];
        const entries = Object.entries(mappedRow);
        for (const [key, value] of entries) {
            const idx = this.getHeaderIndex(key);
            rowArray[idx] = value;
        }
        return rowArray;
    }
};
