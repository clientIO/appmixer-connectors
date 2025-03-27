'use strict';

module.exports = {
    transformFieldsToInspector({ fields, addFields = [], requiredFields = [] }) {
        if (!fields) {
            return [];
        }
        const ignoredFieldTypes = ['autoNumber', 'formula', 'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy', 'button'];
        const specialFieldTypes = ['singleCollaborator', 'multipleAttachments', 'barcode'];
        const inspector = {
            schema: {
                properties: {},
                required: requiredFields
            },
            inputs: {},
            groups: {}
        };
        if (addFields.includes('recordId')) {
            inspector.schema.properties.recordId = { type: 'string' };
            inspector.inputs.recordId = {
                index: 0,
                type: 'text',
                label: 'Record ID',
                tooltip: 'Record ID used to specify which record to update.'
            };
        }

        if (!Array.isArray(fields) || fields.length === 0) {
            return inspector;
        }

        fields.forEach((field, index) => {
            if (ignoredFieldTypes.includes(field.type)) {
                return;
            }
            if (!specialFieldTypes.includes(field.type)) {
                const fieldTypes = checkFieldTypeInputs(field);

                inspector.schema.properties[`${field.id}`] = fieldTypes.schema;
                inspector.inputs[`${field.id}`] = {
                    ...fieldTypes.input,
                    index: index + 1,
                    label: field.name,
                    tooltip: fieldTypes.input.tooltip ?? field.description
                };
                return;
            } else {
                switch (field.type) {
                    case 'singleCollaborator':
                        inspector.schema.properties[`${field.id}|collaboratorId`] = {
                            type: 'string'
                        };
                        inspector.inputs[`${field.id}|collaboratorId`] = {
                            index: index + 1,
                            type: 'text',
                            label: `${field.name} User ID`,
                            tooltip: 'Unique user ID.',
                            group: field.id
                        };

                        inspector.schema.properties[`${field.id}|collaboratorEmail`] = {
                            type: 'string'
                        };
                        inspector.inputs[`${field.id}|collaboratorEmail`] = {
                            index: index + 1,
                            type: 'text',
                            label: `${field.name} Email`,
                            tooltip: "User's email address.",
                            group: field.id
                        };

                        inspector.groups[`${field.id}`] = {
                            label: field.name,
                            index: index
                        };
                        break;
                    case 'barcode': {
                        inspector.schema.properties[`${field.id}|barcodeText`] = {
                            type: 'string'
                        };
                        inspector.inputs[`${field.id}|barcodeText`] = {
                            index: index + 1,
                            type: 'text',
                            label: `${field.name} Text`,
                            tooltip: field.description,
                            group: field.id
                        };
                        inspector.groups[`${field.id}`] = {
                            label: field.name,
                            index: index
                        };
                        break;
                    }
                    case 'multipleAttachments': {
                        inspector.schema.properties[`${field.id}|multipleAttachments`] = {
                        };
                        inspector.inputs[`${field.id}|multipleAttachments`] = {
                            index: index + 1,
                            type: 'expression',
                            label: field.name,
                            tooltip: field.description,
                            levels: ['ADD'],
                            fields: {}
                        };

                        inspector.inputs[`${field.id}|multipleAttachments`].fields.fileUrl = {
                            index: 1,
                            type: 'text',
                            label: `File URL`,
                            tooltip: 'Airtable will download the file at the given url and keep its own copy of it.'
                        };
                        inspector.inputs[`${field.id}|multipleAttachments`].fields.fileName = {
                            index: 2,
                            type: 'text',
                            label: `File Name`,
                            tooltip: 'Name must contain suffix, for example: <code>.png</code> . If empty, Airtable will generate the name automatically.'
                        };
                        break;
                    }
                    default:
                        inspector.schema.properties[`${field.id}`] = { type: 'string' };
                        inspector.inputs[`${field.id}`] = {
                            type: 'text',
                            index: index + 1,
                            label: field.name,
                            tooltip: 'Unknown field type for Appmixer.'
                        };
                }
            }
        });

        return inspector;
    },

    transformFieldsToMultiselect({ fields }) {
        if (!fields) {
            return [];
        }

        if (Array.isArray(fields) && fields.length > 0) {
            return fields.map((field) => {
                return {
                    label: field.name,
                    value: field.id
                };
            });
        } else {
            return [];
        }
    },

    transformFieldsToMergeOnFields({ fields }) {
        if (!fields) {
            return [];
        }

        const allowedFieldTypes = ['number', 'singleLineText', 'multilineText', 'email', 'singleSelect', 'multipleSelects'];
        const filteredFields = fields.filter((field) => {
            return allowedFieldTypes.includes(field.type);
        });

        return filteredFields.map((field) => {
            return {
                label: field.name,
                value: field.id
            };
        });
    },

    transformFieldsToOutput({ fields, addFields = [], outputType = 'object' }) {
        const specialFieldTypes = ['singleCollaborator', 'multipleAttachments', 'barcode', 'multipleSelects', 'createdBy', 'lastModifiedBy', 'button'];

        const outputFields = [
            { label: 'Record ID', value: 'id', schema: { type: 'string' } },
            { label: 'Created Time', value: 'createdTime', schema: { type: 'string' } }];

        if (addFields.includes('action')) {
            outputFields.unshift({ label: 'Action', value: 'action', schema: { type: 'string' } });
        }

        if (!fields || !Array.isArray(fields) || fields.length === 0) {
            return outputFields;
        }

        fields.forEach((field) => {
            if (specialFieldTypes.includes(field.type)) {
                checkFieldTypeOutputs(field, outputFields);
            } else {
                outputFields.push({ label: field.name, value: field.name });
            }
        });

        switch (outputType) {
            case 'first':
            case 'object':
                if (addFields.includes('currentPageIndex')) {
                    outputFields.unshift({ label: 'Current Record Index', value: 'index', schema: { type: 'integer' } });
                }

                if (addFields.includes('pagesCount')) {
                    outputFields.unshift({ label: 'Records Count', value: 'count', schema: { type: 'integer' } });
                }
                return outputFields;
            case 'array':
                const arrayFields = transformSchemaToArray(outputFields);
                return [
                    { label: 'Records Count', value: 'count', schema: { type: 'integer' } },
                    {
                        label: 'Records', value: 'result',
                        schema: {
                            type: 'array', items: {
                                type: 'object', properties: {
                                    ...arrayFields
                                }
                            }
                        }
                    }
                ];
            case 'file':
                return [
                    { label: 'File ID', value: 'fileId' },
                    { label: 'Records Count', value: 'count', schema: { type: 'integer' } }
                ];
            default:
                return outputFields;
        }


    }
};

function checkFieldTypeInputs(field) {
    const propertyField = {
        schema: {},
        input: {}
    };

    switch (field.type) {
        case 'singleLineText':
        case 'phoneNumber':
        case 'email':
        case 'url':
            propertyField.schema.type = 'string';
            propertyField.input.type = 'text';
            break;
        case 'multilineText':
            propertyField.schema.type = 'string';
            propertyField.input.type = 'textarea';
            break;
        case 'number':
        case 'currency':
        case 'percent':
        case 'duration':
            propertyField.schema.type = 'integer';
            propertyField.input.type = 'number';
            break;
        case 'rating':
            propertyField.schema.type = 'integer';
            propertyField.input.type = 'number';
            propertyField.input.min = 1;
            propertyField.input.max = field.options.max;
            break;
        case 'checkbox':
            propertyField.schema.type = 'boolean';
            propertyField.input.type = 'toggle';
            break;
        case 'singleSelect':
            propertyField.schema.type = 'string';
            propertyField.input.type = 'select';
            propertyField.input.options = field.options.choices.map((choice) => {
                return {
                    label: choice.name,
                    value: choice.name
                };
            });
            propertyField.input.options.unshift({ label: '<empty>', clearItem: true });
            break;
        case 'multipleSelects':
            propertyField.schema.type = 'array';
            propertyField.schema.items = { type: 'string' };
            propertyField.input.type = 'multiselect';
            propertyField.input.options = field.options.choices.map((choice) => {
                return {
                    label: choice.name,
                    value: choice.name
                };
            });
            break;
        case 'date':
            propertyField.schema.type = 'string';
            propertyField.schema.format = 'date';
            propertyField.input.type = 'date-time';
            propertyField.input.config = {
                format: 'YYYY-MM-DD',
                enableTime: false
            };
            break;
        default:
            propertyField.schema.type = 'string';
            propertyField.input.type = 'text';
            propertyField.input.tooltip = 'Unknown field type for Appmixer.';
    }

    return propertyField;
}

function checkFieldTypeOutputs(field, outputFields) {
    const defaultProperties = {
        label: field.name,
        value: field.name
    };

    switch (field.type) {
        case 'singleCollaborator':
            outputFields.push({
                ...defaultProperties,
                schema: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', title: `${field.name} ID` },
                        email: { type: 'string', title: `${field.name} Email` },
                        name: { type: 'string', title: `${field.name} Name` }
                    }
                }
            });
            break;
        case 'multipleSelects':
            outputFields.push({
                ...defaultProperties,
                schema: {
                    type: 'array',
                    items: { type: 'string' }
                }
            });
            break;
        case 'barcode':
            outputFields.push({
                ...defaultProperties,
                schema: {
                    type: 'object',
                    properties: {
                        text: {
                            type: 'string',
                            title: `${field.name} Text`
                        }
                    }
                }
            });
            break;
        case 'button':
            outputFields.push({
                ...defaultProperties,
                schema: {
                    type: 'object',
                    properties: {
                        label: {
                            type: 'string',
                            title: `${field.name} Label`
                        },
                        url: {
                            type: 'string',
                            title: `${field.name} URL`
                        }
                    }
                }
            });
            break;
        case 'lastModifiedBy':
        case 'createdBy':
            outputFields.push({
                ...defaultProperties,
                schema: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            title: `${field.name} ID`
                        },
                        email: {
                            type: 'string',
                            title: `${field.name} Email`
                        },
                        name: {
                            type: 'string',
                            title: `${field.name} Name`
                        }
                    }
                }
            });
            break;
        case 'multipleAttachments':
            outputFields.push({
                ...defaultProperties,
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: {
                                type: 'string',
                                title: `${field.name} ID`
                            },
                            width: {
                                type: 'number',
                                title: `${field.name} Width`
                            },
                            height: {
                                type: 'number',
                                title: `${field.name} Height`
                            },
                            url: {
                                type: 'string',
                                title: `${field.name} Url`
                            },
                            filename: {
                                type: 'string',
                                title: `${field.name} Filename`
                            },
                            size: {
                                type: 'number',
                                title: `${field.name} Size`
                            },
                            type: {
                                type: 'string',
                                title: `${field.name} Type`
                            },
                            thumbnails: {
                                type: 'object',
                                properties: {
                                    small: {
                                        type: 'object',
                                        properties: {
                                            url: {
                                                type: 'string',
                                                title: `${field.name} Thumbnails Small Url`
                                            },
                                            width: {
                                                type: 'number',
                                                title: `${field.name} Thumbnails Small Width`
                                            },
                                            height: {
                                                type: 'number',
                                                title: `${field.name} Thumbnails Small Height`
                                            }
                                        },
                                        title: `${field.name} Thumbnails Small`
                                    },
                                    large: {
                                        type: 'object',
                                        properties: {
                                            url: {
                                                type: 'string',
                                                title: `${field.name} Thumbnails Large Url`
                                            },
                                            width: {
                                                type: 'number',
                                                title: `${field.name} Thumbnails Large Width`
                                            },
                                            height: {
                                                type: 'number',
                                                title: `${field.name} Thumbnails Large Height`
                                            }
                                        },
                                        title: `${field.name} Thumbnails Large`
                                    },
                                    full: {
                                        type: 'object',
                                        properties: {
                                            url: {
                                                type: 'string',
                                                title: `${field.name} Thumbnails Full Url`
                                            },
                                            width: {
                                                type: 'number',
                                                title: `${field.name} Thumbnails Full Width`
                                            },
                                            height: {
                                                type: 'number',
                                                title: `${field.name} Thumbnails Full Height`
                                            }
                                        },
                                        title: `${field.name} Thumbnails Full`
                                    }
                                },
                                title: `${field.name} Thumbnails`
                            }
                        }
                    }
                }
            });
            break;
        default:
            outputFields.push(defaultProperties);
    }
}

function transformSchemaToArray(fieldsArray) {
    return fieldsArray.reduce((acc, field) => {
        // If a schema is provided and its type is "object" or "array",
        // we copy the entire schema and add the title from the field's label.
        if (field.schema && (field.schema.type === 'object' || field.schema.type === 'array')) {
            acc[field.value] = {
                ...field.schema,
                title: field.label
            };
        } else {
            // Otherwise, default to the provided schema type or "string"
            const type = (field.schema && field.schema.type) || 'string';
            acc[field.value] = {
                type,
                title: field.label
            };
        }
        return acc;
    }, {});
}
