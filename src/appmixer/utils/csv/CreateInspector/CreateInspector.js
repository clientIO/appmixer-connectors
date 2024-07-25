/* eslint-disable max-len */
'use strict';

const generateInput = (definition, modifications = {}) => {

    return Object.assign(definition, modifications);
};

const fileIdInput = (modifications) => {

    const definition = {
        type: 'filepicker',
        label: 'File ID',
        tooltip: 'The ID of the file.'
    };
    return generateInput(definition, modifications);
};

const delimiterInput = (modifications) => {
    const definition = {
        type: 'text',
        label: 'Delimiter',
        index: 2,
        defaultValue: ',',
        tooltip: 'The character to use as a delimiter between columns.'
    };
    return generateInput(definition, modifications);
};

const filtersInput = (modifications) => {

    const definition = {
        type: 'expression',
        label: 'Filters',
        tooltip: 'Use this to filter the rows in your CSV.',
        fields: [
            {
                type: 'text',
                label: 'Column',
                tooltip: 'Name of the column',
                required: true
            },
            {
                type: 'select',
                label: 'Operator',
                options: [
                    {
                        label: '=',
                        value: '='
                    },
                    {
                        label: '!=',
                        value: '!='
                    },
                    {
                        label: '>',
                        value: '>'
                    },
                    {
                        label: '>=',
                        value: '>='
                    },
                    {
                        label: '<',
                        value: '<'
                    },
                    {
                        label: '<=',
                        value: '<='
                    },
                    {
                        label: 'regex',
                        value: 'regex'
                    }
                ],
                required: true
            },
            {
                type: 'text',
                label: 'Value',
                tooltip: 'Value to compare',
                required: true
            }
        ]
    };
    return generateInput(definition, modifications);
};

const indexesInput = (modifications) => {

    const definition = {
        type: 'text',
        label: 'Indexes',
        tooltip: 'Comma separated list of zero-based indexes or ranges - e.g 0,3,6-7,10.'
    };

    return generateInput(definition, modifications);
};

const indexInput = (modifications) => {

    const definition = {
        type: 'number',
        label: 'Index',
        tooltip: 'Zero-based row index'
    };
    return generateInput(definition, modifications);
};

const columnInput = (modifications) => {

    const definition = {
        type: 'text',
        label: 'Column',
        tooltip: 'Name of the column to retrieve the row value from.'
    };

    return generateInput(definition, modifications);
};

const columnIndexInput = (modifications) => {

    const definition = {
        type: 'number',
        label: 'Column Index',
        tooltip: 'Zero-based index position of the column'
    };
    return generateInput(definition, modifications);
};

const rowFormatInput = (modifications) => {

    const definition = {
        type: 'select',
        label: 'Row format',
        defaultValue: 'object',
        options: [
            {
                label: 'Object',
                value: 'object'
            },
            {
                label: 'Array',
                value: 'array'
            }
        ],
        tooltip: 'Select the desired output row format. Choose between rows represented as arrays ([val1, val2 ...]) or objects ({ col1: val1, col2: val2 }).'
    };
    return generateInput(definition, modifications);
};

module.exports = {

    receive(context) {

        const {
            withHeaders,
            filterRows
        } = context.properties;

        return context.sendJson({ withHeaders, filterRows }, 'out');
    },

    addColumnInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                delimiter: {
                    type: 'string'
                },
                defaultValue: {
                    type: 'string'
                },
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId',
                'delimiter'
            ]
        };

        const inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 }),
            defaultValue: {
                type: 'text',
                label: 'Default value',
                defaultValue: '',
                index: 5,
                tooltip: 'The value that will be used to populate all the rows of the new column.'
            },
            parseNumbers: {
                type: 'toggle',
                label: 'Parse Numbers',
                tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
                defaultValue: true,
                index: 6
            },
            parseBooleans: {
                type: 'toggle',
                label: 'Parse Booleans',
                tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
                defaultValue: true,
                index: 7
            }
        };

        if (withHeaders) {
            schema.properties = Object.assign(schema.properties, {
                insertMode: {
                    enum: [
                        'afterColumn',
                        'beforeColumn'
                    ]
                },
                positioningColumn: {
                    type: 'string'
                },
                columnName: {
                    type: 'string'
                }
            });
            schema.required.push('insertMode', 'positioningColumn', 'columnName');
            inputs.columnName = {
                type: 'text',
                label: 'Column name',
                index: 3,
                tooltip: 'The name of the new column.'
            };
            inputs.insertMode = {
                type: 'select-box',
                options: [
                    {
                        value: 'afterColumn',
                        content: 'After column'
                    },
                    {
                        value: 'beforeColumn',
                        content: 'Before column'
                    }
                ],
                label: 'Column positioning',
                index: 4,
                variables: false,
                tooltip: 'How the position of the new column is determined.'
            };
            inputs.positioningColumn = {
                type: 'text',
                label: 'Positioning column',
                index: 5,
                tooltip: 'Which column is used as a reference to place the new column.'
            };
            inputs.defaultValue.index = 6;
        } else {
            schema.properties.index = {
                type: 'number'
            };
            schema.required.push('index');
            inputs.index = {
                type: 'text',
                label: 'Index',
                index: 3,
                tooltip: 'Zero-based index on which the column will be placed'
            };
            inputs.defaultValue.index = 4;
        }

        return {
            schema,
            inputs
        };
    },

    addRowInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                delimiter: {
                    type: 'string'
                },
                row: {
                    type: 'string'
                },
                rowWithColumns: {
                    type: 'object'
                },
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId',
                'delimiter'
            ]
        };

        const inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 })
        };

        if (withHeaders) {
            schema.properties.rowWithColumns = {
                type: 'object'
            };
            schema.required.push('rowWithColumns');
            inputs.rowWithColumns = {
                type: 'expression',
                levels: [
                    'AND'
                ],
                fields: [
                    {
                        type: 'text',
                        label: 'Column',
                        required: true
                    },
                    {
                        type: 'text',
                        label: 'Value',
                        defaultValue: ''
                    }
                ],
                label: 'Row',
                tooltip: 'Column/value pairs for the new row.',
                index: 3
            };
        } else {
            schema.properties.row = {
                type: 'string'
            };
            schema.required.push('row');
            inputs.row = {
                type: 'text',
                label: 'Row',
                index: 3,
                tooltip: 'Row values separated by a specified delimiter. For example: foo,bar,baz'
            };
        }

        inputs.parseNumbers = {
            type: 'toggle',
            label: 'Parse Numbers',
            tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
            defaultValue: true,
            index: 4
        };
        inputs.parseBooleans = {
            type: 'toggle',
            label: 'Parse Booleans',
            tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
            defaultValue: true,
            index: 5
        };


        return {
            schema,
            inputs
        };
    },

    deleteColumnsInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                delimiter: {
                    type: 'string'
                }
            },
            required: [
                'fileId',
                'delimiter'
            ]
        };

        let inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 })
        };

        if (withHeaders) {
            schema.properties.columns = {
                type: 'string'
            };
            schema.required.push('columns');
            inputs.columns = {
                type: 'text',
                label: 'Column names',
                index: 3,
                tooltip: 'A comma separated list of columns to delete.'
            };
        } else {
            schema.properties.indexes = {
                type: 'string'
            };
            schema.required.push('indexes');
            inputs.indexes = indexesInput({ index: 3 });
        }

        return {
            schema,
            inputs
        };
    },

    deleteRowsInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                delimiter: {
                    type: 'string'
                },
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId',
                'delimiter'
            ]
        };

        let inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 })
        };

        if (withHeaders) {
            schema.properties.filters = {};
            schema.required.push('filters');
            inputs.filters = filtersInput({ index: 3 });
        } else {
            schema.properties.indexes = {
                type: 'string'
            };
            schema.required.push('indexes');
            inputs.indexes = indexesInput({ index: 3 });
        }

        inputs.parseNumbers = {
            type: 'toggle',
            label: 'Parse Numbers',
            tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
            defaultValue: true,
            index: 4
        };
        inputs.parseBooleans = {
            type: 'toggle',
            label: 'Parse Booleans',
            tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
            defaultValue: true,
            index: 5
        };

        return {
            schema,
            inputs
        };
    },

    getCellInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId'
            ]
        };

        let inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 })
        };

        if (withHeaders) {
            schema.properties.filters = {};
            schema.properties.column = {
                type: 'string'
            };
            schema.required.push('filters');
            schema.required.push('column');
            inputs.filters = filtersInput({ index: 3 });
            inputs.column = columnInput({ index: 4 });
        } else {
            schema.properties.index = {
                type: 'number'
            };
            schema.properties.columnIndex = {
                type: 'number'
            };
            schema.required.push('index');
            schema.required.push('columnIndex');
            inputs.index = indexInput({ index: 3 });
            inputs.columnIndex = columnIndexInput({ index: 4 });
        }

        inputs.parseNumbers = {
            type: 'toggle',
            label: 'Parse Numbers',
            tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
            defaultValue: true,
            index: 5
        };

        inputs.parseBooleans = {
            type: 'toggle',
            label: 'Parse Booleans',
            tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
            defaultValue: true,
            index: 6
        };

        return {
            schema,
            inputs
        };
    },

    getRowInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                delimiter: {
                    type: 'string'
                },
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId',
                'delimiter'
            ]
        };

        let inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 })
        };

        if (withHeaders) {
            schema.properties.filters = {};
            schema.properties.rowFormat = {
                type: 'string'
            };
            schema.required.push('filters', 'rowFormat');
            inputs.filters = filtersInput({ index: 3 });
            inputs.rowFormat = rowFormatInput({ index: 4 });
        } else {
            schema.properties.index = { type: 'number' };
            schema.required.push('index');
            inputs.index = indexInput({ index: 3 });
        }

        inputs.parseNumbers = {
            type: 'toggle',
            label: 'Parse Numbers',
            tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
            defaultValue: true,
            index: 5
        };

        inputs.parseBooleans = {
            type: 'toggle',
            label: 'Parse Booleans',
            tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
            defaultValue: true,
            index: 6
        };

        return {
            schema,
            inputs
        };
    },

    getRowsInspector({ withHeaders, filterRows }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                delimiter: {
                    type: 'string'
                },
                allAtOnce: {
                    type: 'boolean'
                },
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId',
                'delimiter',
                'allAtOnce'
            ]
        };

        let inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 }),
            allAtOnce: {
                type: 'toggle',
                label: 'All rows in one message',
                tooltip: 'Set to true to output all rows at once. Set to false to output one row at a time.',
                defaultValue: true,
                index: 5
            },
            parseNumbers: {
                type: 'toggle',
                label: 'Parse Numbers',
                tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
                defaultValue: true,
                index: 6
            },
            parseBooleans: {
                type: 'toggle',
                label: 'Parse Booleans',
                tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
                defaultValue: true,
                index: 7
            }
        };

        if (withHeaders) {
            schema.properties.rowFormat = {
                type: 'string'
            };
            schema.required.push('rowFormat');
            inputs.rowFormat = rowFormatInput({ index: 4 });
        }

        if (filterRows) {
            if (withHeaders) {
                schema.properties.filters = {};
                schema.required.push('filters');
                inputs.filters = filtersInput({ index: 3 });
            } else {
                schema.properties.indexes = {
                    type: 'string'
                };
                schema.required.push('indexes');
                inputs.indexes = indexesInput({ index: 3 });
            }
        }

        return {
            schema,
            inputs
        };
    },

    updateRowsInspector({ withHeaders }) {

        const schema = {
            type: 'object',
            properties: {
                fileId: {},
                parseNumbers: {
                    type: 'boolean'
                },
                parseBooleans: {
                    type: 'boolean'
                }
            },
            required: [
                'fileId',
                'delimiter'
            ]
        };

        let inputs = {
            fileId: fileIdInput({ index: 1 }),
            delimiter: delimiterInput({ index: 2 })
        };

        if (withHeaders) {
            schema.properties.filters = {};
            schema.properties.values = {};
            schema.required.push('filters', 'values');
            inputs.filters = filtersInput({ index: 3 });
            inputs.values = {
                type: 'expression',
                label: 'Values',
                tooltip: 'Column/value pairs to update in the matched rows.',
                index: 4,
                levels: [
                    'AND'
                ],
                fields: [
                    {
                        type: 'text',
                        label: 'Column',
                        required: true
                    },
                    {
                        type: 'text',
                        label: 'Value',
                        required: true
                    }
                ]
            };
        } else {
            schema.properties.indexes = {
                type: 'string'
            };
            schema.properties.indexedValues = {};
            schema.required.push('indexes', 'indexedValues');
            inputs.indexes = indexesInput({ index: 3 });
            inputs.indexedValues = {
                type: 'expression',
                label: 'Values',
                tooltip: 'Column index/value pairs to update in the matched rows.',
                index: 4,
                levels: [
                    'AND'
                ],
                fields: [
                    {
                        type: 'text',
                        label: 'Column index',
                        required: true
                    },
                    {
                        type: 'text',
                        label: 'Value',
                        required: true
                    }
                ]
            };
        }

        inputs.parseNumbers = {
            type: 'toggle',
            label: 'Parse Numbers',
            tooltip: 'Set to parse numbers (i.e. instead of returning a string for a value that looks like a number, the string is converted to a number where possible). Technically, any format supported by the JavaScript parseFloat() including scientific notation, Infinity and NaN, is converted to a number. Note that if your CSV contains telephone numbers, you should disable this setting since it will convert e.g. +447975777666 to 447975777666.',
            defaultValue: true,
            index: 5
        };

        inputs.parseBooleans = {
            type: 'toggle',
            label: 'Parse Booleans',
            tooltip: 'Set to parse booleans. Strictly lowercase <code>true</code> and <code>false</code> are converted to booleans.',
            defaultValue: true,
            index: 6
        };

        return {
            schema,
            inputs
        };
    }
};
