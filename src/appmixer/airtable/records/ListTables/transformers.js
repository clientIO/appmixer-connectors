'use strict';

module.exports = {
    transformFieldsToInspector({ fields, addFields = [] }) {
        const ignoredFieldTypes = ['autoNumber', 'formula', 'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy', 'button'];
        const specialFieldTypes = ['singleCollaborator', 'multipleAttachments', 'barcode'];
        const inspector = {
            schema: {
                properties: {}
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
                const fieldTypes = checkFieldType(field);

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

    transformFieldsToMergeOnFields({ fields, addFields = [] }) {
        const allowedFieldTypes = ['number', 'singleLineText', 'multilineText', 'singleSelect', 'multipleSelects', 'date'];
        const filteredFields = fields.filter((field) => {
            return allowedFieldTypes.includes(field.type);
        });

        return filteredFields.map((field) => {
            return {
                label: field.name,
                value: field.id
            };
        });
    }
};

function checkFieldType(field) {
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
                    value: choice.id
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
                    value: choice.id
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
