'use strict';
const AutoDetectDecoderStream = require('autodetect-decoder-stream');
const CsvReadableStream = require('csv-reader');
const { PassThrough, pipeline } = require('stream');
const { parse } = require('csv-parse/sync'); // Use the synchronous version of csv-parse
const { passesFilter, indexExpressionToArray, passesIndexFilter } = require('./helpers');

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
     * Appends rows to the end of the file.
     * @param rows {Array} Array of rows to add
     * @return {Promise<*>}
     * @public
     */
    async addRows({ rows }) {

        const config = this.context.config;
        const lock = await this.context.lock(this.fileId, {
            ttl: parseInt(config.lockTTL, 10) || 60000 // Default 1 minute TTL
        });

        let readStream;
        let writeStream;
        let lockExtendInterval;

        const destroy = function() {

            if (readStream) readStream.destroy();
            if (writeStream) writeStream.destroy();
            if (lockExtendInterval) clearInterval(lockExtendInterval);
            if (lock) lock.unlock();
        };

        try {

            const lockExtendTime = parseInt(config.lockExtendTime, 10) || 1000 * 60 * 1;
            const max = Math.ceil((1000 * 60 * 22) / lockExtendTime); // max execution time 23 minutes
            let i = 0;

            // Extend the lock every 59 seconds up to 22 minutes
            lockExtendInterval = setInterval(async () => {
                i++;
                if (i > max) {
                    destroy();
                    throw new Error('Lock extend failed. Max attempts reached.');
                }
                await lock.extend(lockExtendTime);
            }, config.lockExtendInterval || 59000);

            // We're not interested in the data, we just need to read the first row to get the headers and the last line.
            readStream = await this.context.getFileReadStream(this.fileId);
            writeStream = new PassThrough();

            let firstRowRead = true;
            let lastLine = null;
            const promise = new Promise((resolve, reject) => {

                // Reading all data because we need to always check the last line. And sometimes the first line for headers.
                readStream.on('data', (data) => {
                    // Read the first row to get the headers. Only if we use headers.
                    if (firstRowRead && this.withHeaders) {
                        firstRowRead = false;
                        try {
                            this.header = parse(data, { delimiter: this.delimiter })[0];
                        } catch (error) {
                            reject(new this.context.CancelError('Error reading headers', error));
                        }
                    }

                    // Save the last line for a check in `end` event.
                    lastLine = data;
                });
                readStream.on('error', reject);

                readStream.on('end', () => {
                    // If there is no empty line at the end of the file, add one
                    if (!lastLine.toString().endsWith('\n')) {
                        writeStream.write('\n');
                    }
                    const rowsToAdd = this.withHeaders ? this.addHeaders(rows, this.getHeaders()) : rows;
                    // Append new rows to the end of the file
                    this.writeRows(writeStream, rowsToAdd);

                    // If all the new rows are empty, warn the user.
                    if (rowsToAdd.every(row => row.every(cell => !cell))) {
                        this.context.log({ warning: 'Empty rows added', details: 'Please make sure you are adding the correct data and using the correct delimiter.' });
                    }
                });

                const stream = pipeline(
                    readStream,
                    writeStream,
                    (e) => {
                        if (e) reject(e);
                    }
                );

                this.context.replaceFileStream(this.fileId, stream)
                    .then(resolve)
                    .catch(reject);
            });

            return await promise;
        } finally {
            destroy();
        }
    }

    formatRow(rowData) {
        if (!Array.isArray(rowData)) {
            throw new Error('Unexpected row data format: ' + JSON.stringify(rowData));
        }
        return rowData.join(this.delimiter) + '\n';
    }

    writeRows(writeStream, rows) {
        for (const row of rows) {
            writeStream.write(this.formatRow(row));
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
     * @deprecated Use parse from csv-parse instead
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

    /**
     * @param rows
     * @param headers
     * @returns {*}
     * @protected
     */
    addHeaders(rows, headers) {
        return rows.map(rowObj => {
            const newRow = [];
            headers.forEach(header => {
                newRow.push(rowObj[header] || '');
            });
            return newRow;
        });
    };
};

