const { parse } = require('csv-parse');
const { Transform } = require('stream');

const PARSE_FLOAT_TEST = /^[-+]?\d+(?:\.\d*)?(?:[eE]\+\d+)?$|^(?:\d+)?\.\d+(?:e+\d+)?$|^[-+]?Infinity$|^[-+]?NaN$/;

module.exports = {
    getCSVReadStream: function() {
        return parse({
            bom: true,
            columns: true,
            cast: function(value) {

                const str = value?.toLowerCase();
                if (str === 'true') return true;
                if (str === 'false') return false;
                if (PARSE_FLOAT_TEST.test(value)) {
                    return parseFloat(value);
                }
                return value;
            },
            trim: true,
            relax_column_count: true,
            cast_date: true
        });
    },
    csvToJsonTransform: function() {
        return new Transform({
            writableObjectMode: true,
            readableObjectMode: false,
            transform(chunk, encoding, callback) {
                try {
                    const prefix = this.firstCharWritten ? ',' : '[';
                    this.firstCharWritten = true;
                    this.push(`${prefix}${JSON.stringify(chunk, '\t', 4)}`);
                    callback();
                } catch (err) {
                    callback(new Error('Error transforming CSV to JSON: ' + err.message));
                }
            },
            final(callback) {
                if (!this.firstCharWritten) {
                    this.push('['); // empty csv file
                }
                this.push(']');
                callback();
            }
        });
    },

    jsonToCsvTransform: function(delimiter = ',') {
        return new Transform({
            writableObjectMode: true,
            readableObjectMode: false,
            transform(chunk, encoding, callback) {
                try {
                    if (!this.headerWritten) {

                        this.push(Object.keys(chunk).join(delimiter));
                        this.push('\n');
                        this.headerWritten = true;
                    }
                    this.push(Object.values(chunk).map(item => {
                        if (typeof item === 'string' && item.includes(delimiter)) {
                            return `"${item}"`;
                        }
                        return item;
                    }).join(delimiter));
                    this.push('\n');
                    callback();
                } catch (err) {
                    callback(new Error('Error transforming CSV to JSON: ' + err.message));
                }
            },
            final(callback) {
                this.push(']');
                callback();
            }
        });
    }

};
